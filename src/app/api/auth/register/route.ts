import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createUserWithOrganization } from "@/lib/auth";
import { createToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/url";

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const pendingInvite = await prisma.invitation.findFirst({
    where: { email, expiresAt: { gt: new Date() } },
  });

  const hashed = await bcrypt.hash(password, 12);
  await createUserWithOrganization({
    email,
    name,
    password: hashed,
    skipDefaultOrg: !!pendingInvite,
  });

  const rawToken = await createToken(`verify:${email}`, VERIFY_TOKEN_TTL_MS);
  await sendVerificationEmail({
    to: email,
    verifyUrl: `${await resolveAppUrl()}/verify-email/${rawToken}`,
  });

  return NextResponse.json({ ok: true });
}
