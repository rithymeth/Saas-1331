import crypto from "crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

const INVITE_EXPIRY_DAYS = 7;

export async function createInvitation(input: {
  organizationId: string;
  organizationName: string;
  email: string;
  role: Role;
  invitedByEmail: string;
  appUrl: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false as const, reason: "invalid_email" as const };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: existingUser.id, organizationId: input.organizationId },
      },
    });
    if (alreadyMember) return { ok: false as const, reason: "already_member" as const };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.invitation.upsert({
    where: { email_organizationId: { email, organizationId: input.organizationId } },
    create: {
      email,
      organizationId: input.organizationId,
      role: input.role,
      token,
      invitedByEmail: input.invitedByEmail,
      expiresAt,
    },
    update: { token, role: input.role, expiresAt },
  });

  await sendInviteEmail({
    to: email,
    orgName: input.organizationName,
    invitedByEmail: input.invitedByEmail,
    inviteUrl: `${input.appUrl}/invite/${token}`,
  });

  return { ok: true as const };
}
