import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { createInvitation } from "@/lib/invitations";
import { resolveAppUrl } from "@/lib/url";

async function inviteToOrg(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user || !isSuperAdmin(session.user.email)) redirect("/dashboard");

  const organizationId = String(formData.get("organizationId") ?? "");
  const email = String(formData.get("email") ?? "");
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return;

  await createInvitation({
    organizationId: organization.id,
    organizationName: organization.name,
    email,
    role,
    invitedByEmail: session.user.email ?? "",
    appUrl: await resolveAppUrl(),
  });

  revalidatePath(`/admin/organizations/${organizationId}`);
}

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      invitations: { orderBy: { createdAt: "desc" } },
      subscription: true,
    },
  });
  if (!organization) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold">{organization.name}</h1>
        <p className="text-sm text-gray-500">
          {organization.slug} · {organization.subscription?.status ?? "No subscription"}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Members</h2>
        <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
          {organization.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{member.user.name ?? member.user.email}</p>
                <p className="text-xs text-gray-500">{member.user.email}</p>
              </div>
              <span className="text-xs text-gray-500">{member.role}</span>
            </div>
          ))}
          {organization.members.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500">No members.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Invite someone to this org</h2>
        <form action={inviteToOrg} className="flex gap-2">
          <input type="hidden" name="organizationId" value={organization.id} />
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

      {organization.invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-500">Pending invites</h2>
          <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
            {organization.invitations.map((invite) => {
              const expired = invite.expiresAt < new Date();
              return (
                <div key={invite.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-gray-500">
                    {invite.role} · {expired ? "expired" : `expires ${invite.expiresAt.toLocaleDateString()}`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
