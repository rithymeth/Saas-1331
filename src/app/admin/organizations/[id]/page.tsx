import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { deleteOrganization } from "@/lib/organizations";
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

async function toggleSuspension(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user || !isSuperAdmin(session.user.email)) redirect("/dashboard");

  const organizationId = String(formData.get("organizationId") ?? "");
  const suspend = formData.get("suspend") === "true";

  await prisma.organization.update({
    where: { id: organizationId },
    data: { suspendedAt: suspend ? new Date() : null },
  });

  revalidatePath(`/admin/organizations/${organizationId}`);
  revalidatePath("/admin");
}

async function deleteOrganizationAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user || !isSuperAdmin(session.user.email)) redirect("/dashboard");

  const organizationId = String(formData.get("organizationId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const result = await deleteOrganization({ organizationId, confirmation });

  if (!result.ok) {
    redirect(`/admin/organizations/${organizationId}?deleteError=${result.reason}`);
  }

  revalidatePath("/admin");
  redirect(`/admin?deleted=${encodeURIComponent(result.slug)}`);
}

const DELETE_ERROR_MESSAGE: Record<string, string> = {
  confirmation_mismatch: "The confirmation value must exactly match the organization slug.",
  must_suspend_first: "Suspend the organization before deleting it.",
  active_subscription: "Cancel the organization's active billing before deleting it.",
  not_found: "That organization no longer exists.",
};

export default async function AdminOrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deleteError?: string }>;
}) {
  const { id } = await params;
  const { deleteError } = await searchParams;

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
          <p className="text-sm text-gray-500">
            {organization.slug} · {organization.subscription?.status ?? "No subscription"}
            {organization.suspendedAt && " · suspended"}
          </p>
        </div>
        <form action={toggleSuspension}>
          <input type="hidden" name="organizationId" value={organization.id} />
          <input type="hidden" name="suspend" value={organization.suspendedAt ? "false" : "true"} />
          <button
            type="submit"
            className={
              organization.suspendedAt
                ? "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                : "rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            }
          >
            {organization.suspendedAt ? "Unsuspend" : "Suspend"}
          </button>
        </form>
      </div>

      {deleteError && DELETE_ERROR_MESSAGE[deleteError] && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {DELETE_ERROR_MESSAGE[deleteError]}
        </p>
      )}

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

      <section className="flex flex-col gap-3 rounded-md border border-red-200 p-4">
        <div>
          <h2 className="text-sm font-medium text-red-700">Danger zone</h2>
          <p className="text-sm text-gray-600">
            Deleting an organization permanently removes its members, invites, projects, tasks,
            API keys, and local billing records.
          </p>
        </div>
        <p className="text-xs text-gray-500">
          Suspend the organization first, then type <code>{organization.slug}</code> to confirm.
          Active or delinquent subscriptions must be resolved before deletion.
        </p>
        <form action={deleteOrganizationAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="organizationId" value={organization.id} />
          <div className="flex-1">
            <label htmlFor="confirmation" className="mb-1 block text-xs text-gray-500">
              Confirm slug
            </label>
            <input
              id="confirmation"
              name="confirmation"
              required
              placeholder={organization.slug}
              className="w-full rounded-md border border-red-300 px-3 py-2 text-sm outline-none focus:border-red-600"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!organization.suspendedAt}
          >
            Delete organization
          </button>
        </form>
      </section>
    </div>
  );
}
