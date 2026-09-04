import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { getProjectForOrg, getTaskForOrg } from "@/lib/projects";
import { notifyTaskAssignment } from "@/lib/notifications";
import { TaskBoard } from "@/components/task-board";

async function createTask(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProjectForOrg(projectId, membership);
  if (!project) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;

  if (assigneeId) {
    const isMember = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: assigneeId, organizationId: membership.organizationId } },
    });
    if (!isMember) return;
  }

  const task = await prisma.task.create({
    data: { projectId, title, description, assigneeId, dueDate },
  });

  if (assigneeId) {
    await notifyTaskAssignment({
      assigneeId,
      actorId: session.user.id,
      actorEmail: session.user.email ?? "",
      taskId: task.id,
      taskTitle: task.title,
      projectId,
      projectName: project.name,
    });
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
}

async function updateTaskStatus(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const status = formData.get("status");
  if (status !== "TODO" && status !== "IN_PROGRESS" && status !== "DONE") return;

  const taskId = String(formData.get("taskId") ?? "");
  const task = await getTaskForOrg(taskId, membership);
  if (!task) return;

  await prisma.task.update({ where: { id: taskId }, data: { status } });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
}

async function deleteTask(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const taskId = String(formData.get("taskId") ?? "");
  const task = await getTaskForOrg(taskId, membership);
  if (!task) return;

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/dashboard/projects/${task.projectId}`);
}

async function updateProjectMembers(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") return;

  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProjectForOrg(projectId, membership);
  if (!project) return;

  const selectedIds = formData.getAll("memberIds").map(String);
  const validMemberIds = await prisma.organizationMember.findMany({
    where: { organizationId: membership.organizationId, userId: { in: selectedIds } },
    select: { userId: true },
  });

  await prisma.$transaction([
    prisma.projectMember.deleteMany({ where: { projectId } }),
    ...(validMemberIds.length > 0
      ? [
          prisma.projectMember.createMany({
            data: validMemberIds.map((m) => ({ projectId, userId: m.userId })),
          }),
        ]
      : []),
  ]);

  revalidatePath(`/dashboard/projects/${projectId}`);
}

export default async function ProjectBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  // A project ID from another organization — or one restricted to members
  // this user isn't part of — must 404, not leak its existence or data.
  const project = await getProjectForOrg(id, membership);
  if (!project) notFound();

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: membership.organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const canManageMembers = membership.role === "OWNER" || membership.role === "ADMIN";
  const restrictedMemberIds = new Set(project.members.map((m) => m.userId));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">{project.name}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Access</h2>
        {canManageMembers ? (
          <form action={updateProjectMembers} className="flex flex-col gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <p className="text-xs text-gray-500">
              Leave everyone unchecked to keep this project open to the whole organization.
              Check specific members to restrict it to just them (owners/admins always have
              access).
            </p>
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="memberIds"
                    value={m.userId}
                    defaultChecked={restrictedMemberIds.has(m.userId)}
                  />
                  {m.user.name ?? m.user.email}
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="w-fit rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Save access
            </button>
          </form>
        ) : (
          <p className="text-xs text-gray-500">
            {restrictedMemberIds.size > 0
              ? "This project is restricted to specific members."
              : "This project is open to everyone in the organization."}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">New task</h2>
        <form action={createTask} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Title</label>
            <input
              name="title"
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Description</label>
            <input
              name="description"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Assignee</label>
            <select
              name="assigneeId"
              defaultValue=""
              className="rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name ?? m.user.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Due date</label>
            <input
              type="date"
              name="dueDate"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Add task
          </button>
        </form>
      </section>

      <TaskBoard
        projectId={project.id}
        tasks={project.tasks}
        updateTaskStatus={updateTaskStatus}
        deleteTask={deleteTask}
      />
    </div>
  );
}
