import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const providers: Provider[] = [
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string | undefined;
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.password) return null;

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        if (!existing) {
          const pendingInvite = await prisma.invitation.findFirst({
            where: { email: user.email, expiresAt: { gt: new Date() } },
          });
          await createUserWithOrganization({
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            skipDefaultOrg: !!pendingInvite,
            emailVerified: new Date(),
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.userId = dbUser.id;
          token.emailVerified = !!dbUser.emailVerified;
          token.passwordChangedAt = dbUser.passwordChangedAt?.getTime() ?? null;
        }
        return token;
      }

      // On every later request, confirm the password hasn't changed since this
      // token was issued — otherwise a stolen token would keep working even
      // after the account owner resets their password to lock the thief out.
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { passwordChangedAt: true },
        });
        if (!dbUser) return null;

        const currentChangedAt = dbUser.passwordChangedAt?.getTime() ?? null;
        if (currentChangedAt !== (token.passwordChangedAt ?? null)) return null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.isEmailVerified = !!token.emailVerified;
      }
      return session;
    },
  },
});

export async function createUserWithOrganization(input: {
  email: string;
  name?: string;
  password?: string;
  image?: string;
  skipDefaultOrg?: boolean;
  emailVerified?: Date;
}) {
  if (input.skipDefaultOrg) {
    return prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: input.password,
        image: input.image,
        emailVerified: input.emailVerified,
      },
    });
  }

  const orgName = input.name ? `${input.name}'s Organization` : "My Organization";
  const slug = await uniqueSlug(orgName);

  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: input.password,
      image: input.image,
      emailVerified: input.emailVerified,
      memberships: {
        create: {
          role: "OWNER",
          organization: {
            create: { name: orgName, slug },
          },
        },
      },
    },
  });
}

async function uniqueSlug(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "org";

  let slug = base;
  let n = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}
