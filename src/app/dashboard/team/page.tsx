import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MemberRoleSelect } from "@/components/member-role-select";

const INVITE_EXPIRY_DAYS = 7;

async function getMembership(userId: string) {
  return prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

async function inviteMember(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getMembership(session.user.id);
  if (!membership || membership.role === "MEMBER") return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";
  if (!email) return;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: membership.organizationId,
        },
      },
    });
    if (alreadyMember) return;
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.invitation.upsert({
    where: { email_organizationId: { email, organizationId: membership.organizationId } },
    create: {
      email,
      organizationId: membership.organizationId,
      role,
      token,
      invitedByEmail: session.user.email ?? "",
      expiresAt,
    },
    update: { token, role, expiresAt },
  });

  revalidatePath("/dashboard/team");
}

async function revokeInvitation(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getMembership(session.user.id);
  if (!membership || membership.role === "MEMBER") return;

  const invitationId = String(formData.get("invitationId") ?? "");
  await prisma.invitation.deleteMany({
    where: { id: invitationId, organizationId: membership.organizationId },
  });

  revalidatePath("/dashboard/team");
}

async function removeMember(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getMembership(session.user.id);
  if (!membership || membership.role === "MEMBER") return;

  const memberId = String(formData.get("memberId") ?? "");
  const target = await prisma.organizationMember.findUnique({ where: { id: memberId } });
  if (!target || target.organizationId !== membership.organizationId || target.role === "OWNER") {
    return;
  }

  await prisma.organizationMember.delete({ where: { id: memberId } });
  revalidatePath("/dashboard/team");
}

async function updateMemberRole(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getMembership(session.user.id);
  if (!membership || membership.role !== "OWNER") return;

  const memberId = String(formData.get("memberId") ?? "");
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";

  const target = await prisma.organizationMember.findUnique({ where: { id: memberId } });
  if (!target || target.organizationId !== membership.organizationId || target.role === "OWNER") {
    return;
  }

  await prisma.organizationMember.update({ where: { id: memberId }, data: { role } });
  revalidatePath("/dashboard/team");
}

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const [members, invitations, host] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: membership.organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { createdAt: "desc" },
    }),
    headers().then((h) => h.get("host")),
  ]);

  const canManage = membership.role !== "MEMBER";
  const isOwner = membership.role === "OWNER";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <h1 className="text-2xl font-semibold">Team</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Members</h2>
        <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{member.user.name ?? member.user.email}</p>
                <p className="text-xs text-gray-500">{member.user.email}</p>
              </div>

              <div className="flex items-center gap-2">
                {isOwner && member.role !== "OWNER" ? (
                  <MemberRoleSelect
                    memberId={member.id}
                    currentRole={member.role}
                    action={updateMemberRole}
                  />
                ) : (
                  <span className="text-xs text-gray-500">{member.role}</span>
                )}

                {canManage && member.role !== "OWNER" && member.userId !== session.user.id && (
                  <form action={removeMember}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {canManage && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-500">Invite someone</h2>
          <form action={inviteMember} className="flex gap-2">
            <input
              type="email"
              name="email"
              required
              placeholder="teammate@company.com"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
            <select
              name="role"
              defaultValue="MEMBER"
              className="rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Invite
            </button>
          </form>
        </section>
      )}

      {canManage && invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-500">Pending invites</h2>
          <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
            {invitations.map((invite) => {
              const expired = invite.expiresAt < new Date();
              return (
                <div key={invite.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        {invite.role} · {expired ? "expired" : `expires ${invite.expiresAt.toLocaleDateString()}`}
                      </p>
                    </div>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="invitationId" value={invite.id} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Revoke
                      </button>
                    </form>
                  </div>
                  {!expired && (
                    <code className="truncate rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                      {`${protocol}://${host}/invite/${invite.token}`}
                    </code>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">
            No email sending is wired up yet — copy the link above and send it to the invitee directly.
          </p>
        </section>
      )}
    </div>
  );
}
