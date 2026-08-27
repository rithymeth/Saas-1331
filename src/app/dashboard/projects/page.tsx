import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";

async function createProject(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.project.create({
    data: { organizationId: membership.organizationId, name },
  });

  revalidatePath("/dashboard/projects");
}

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const projects = await prisma.project.findMany({
    where: { organizationId: membership.organizationId },
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Projects</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">New project</h2>
        <form action={createProject} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="e.g. Website redesign"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Create
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <span className="text-sm font-medium">{project.name}</span>
              <span className="text-xs text-gray-500">
                {project._count.tasks} task{project._count.tasks === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500">No projects yet — create one above.</p>
          )}
        </div>
      </section>
    </div>
  );
}
