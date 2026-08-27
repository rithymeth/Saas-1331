import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

/**
 * No-op (logs only) when RESEND_API_KEY isn't set, so invites/dev work without an email provider.
 */
export async function sendInviteEmail(input: {
  to: string;
  orgName: string;
  invitedByEmail: string;
  inviteUrl: string;
}) {
  if (!resend) {
    console.log(`[email] (RESEND_API_KEY not set) invite for ${input.to}: ${input.inviteUrl}`);
    return;
  }

  await resend.emails.send({
    from,
    to: input.to,
    subject: `You've been invited to join ${input.orgName}`,
    html: `
      <p>${input.invitedByEmail} invited you to join <strong>${input.orgName}</strong>.</p>
      <p><a href="${input.inviteUrl}">Accept the invite</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

export async function sendPasswordResetEmail(input: { to: string; resetUrl: string }) {
  if (!resend) {
    console.log(`[email] (RESEND_API_KEY not set) password reset for ${input.to}: ${input.resetUrl}`);
    return;
  }

  await resend.emails.send({
    from,
    to: input.to,
    subject: "Reset your password",
    html: `
      <p>Someone requested a password reset for this account. If this wasn't you, ignore this email.</p>
      <p><a href="${input.resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  });
}

export async function sendVerificationEmail(input: { to: string; verifyUrl: string }) {
  if (!resend) {
    console.log(`[email] (RESEND_API_KEY not set) verification for ${input.to}: ${input.verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from,
    to: input.to,
    subject: "Verify your email",
    html: `
      <p><a href="${input.verifyUrl}">Verify your email address</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}
