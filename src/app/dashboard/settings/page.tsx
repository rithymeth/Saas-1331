import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function updateOrgName(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } },
  });
  if (!membership) return;

  await prisma.organization.update({
    where: { id: membership.organizationId },
    data: { name },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex max-w-md flex-col gap-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-500">Organization name</h2>
        <form action={updateOrgName} className="flex gap-2">
          <input
            name="name"
            defaultValue={membership?.organization.name}
            disabled={membership?.role === "MEMBER"}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={membership?.role === "MEMBER"}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Save
          </button>
        </form>
        {membership?.role === "MEMBER" && (
          <p className="text-xs text-gray-500">
            Only owners and admins can rename the organization.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-gray-500">Your role</h2>
        <p className="text-sm">{membership?.role}</p>
      </div>
    </div>
  );
}
