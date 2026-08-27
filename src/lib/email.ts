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
