import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { projectVisibilityFilter } from "@/lib/projects";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);

  const projects = membership
    ? await prisma.project.findMany({
        where: {
          organizationId: membership.organizationId,
          ...projectVisibilityFilter(membership.userId, membership.role),
        },
        include: { _count: { select: { tasks: { where: { status: { not: "DONE" } } } } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      })
    : [];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">
        Welcome{session.user.name ? `, ${session.user.name}` : ""}
      </h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500">Recent projects</h2>
          <Link href="/dashboard/projects" className="text-xs text-gray-500 underline">
            View all
          </Link>
        </div>

        {projects.length > 0 ? (
          <div className="flex max-w-2xl flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="text-sm font-medium">{project.name}</span>
                <span className="text-xs text-gray-500">
                  {project._count.tasks} open task{project._count.tasks === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl rounded-md border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
            No projects yet.{" "}
            <Link href="/dashboard/projects" className="underline">
              Create your first one
            </Link>
            .
          </div>
        )}
      </section>
    </div>
  );
}
