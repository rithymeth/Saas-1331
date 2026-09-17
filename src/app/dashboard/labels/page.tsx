import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";

async function createLabel(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  if (!name || !/^#[0-9a-fA-F]{6}$/.test(color)) return;

  await prisma.label.upsert({
    where: { organizationId_name: { organizationId: membership.organizationId, name } },
    create: { organizationId: membership.organizationId, name, color },
    update: { color },
  });

  revalidatePath("/dashboard/labels");
}

async function deleteLabel(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const labelId = String(formData.get("labelId") ?? "");
  await prisma.label.deleteMany({
    where: { id: labelId, organizationId: membership.organizationId },
  });

  revalidatePath("/dashboard/labels");
}

export default async function LabelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const labels = await prisma.label.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex max-w-md flex-col gap-8">
      <h1 className="text-2xl font-semibold">Labels</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">New label</h2>
        <form action={createLabel} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="name" className="text-xs text-gray-500">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="e.g. Bug"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="color" className="text-xs text-gray-500">
              Color
            </label>
            <input
              id="color"
              type="color"
              name="color"
              defaultValue="#6b7280"
              className="h-9 w-12 rounded-md border border-gray-300"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Save
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
          {labels.map((label) => (
            <div key={label.id} className="flex items-center justify-between px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </span>
              <form action={deleteLabel}>
                <input type="hidden" name="labelId" value={label.id} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </form>
            </div>
          ))}
          {labels.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500">No labels yet — create one above.</p>
          )}
        </div>
      </section>
    </div>
  );
}
