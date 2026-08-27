import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

/**
 * Embeds passwordChangedAt in the token at sign-in, then re-checks it against
 * the DB on every later request — returning null (which NextAuth treats as a
 * sign-out, clearing the session cookie) if it no longer matches. Without
 * this, a stolen session would keep working indefinitely even after the
 * account owner resets their password specifically to lock the thief out.
 *
 * Kept in its own module (rather than alongside the NextAuth(...) setup in
 * auth.ts) so it can be unit-tested without pulling in next-auth's runtime,
 * which depends on Next.js's edge shims that aren't available under Vitest.
 */
export async function jwtCallback({ token, user }: { token: JWT; user?: { email?: string | null } }) {
  if (user?.email) {
    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    if (dbUser) {
      token.userId = dbUser.id;
      token.emailVerified = !!dbUser.emailVerified;
      token.passwordChangedAt = dbUser.passwordChangedAt?.getTime() ?? null;
    }
    return token;
  }

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
}
