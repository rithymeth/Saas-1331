import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { getProjectForOrg, getTaskForOrg } from "@/lib/projects";
import { notifyTaskAssignment } from "@/lib/notifications";

async function updateTask(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const taskId = String(formData.get("taskId") ?? "");
  const task = await getTaskForOrg(taskId, membership);
  if (!task) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  const status = formData.get("status");
  const validStatus = status === "TODO" || status === "IN_PROGRESS" || status === "DONE" ? status : task.status;

  if (assigneeId) {
    const isMember = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: assigneeId, organizationId: membership.organizationId } },
    });
    if (!isMember) return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { title, description, assigneeId, dueDate, status: validStatus },
  });

  if (assigneeId && assigneeId !== task.assigneeId) {
    await notifyTaskAssignment({
      assigneeId,
      actorId: session.user.id,
      actorEmail: session.user.email ?? "",
      taskId: task.id,
      taskTitle: title,
      projectId: task.projectId,
      projectName: task.project.name,
    });
  }

  revalidatePath(`/dashboard/projects/${task.projectId}`);
  redirect(`/dashboard/projects/${task.projectId}`);
}

async function addComment(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const taskId = String(formData.get("taskId") ?? "");
  const task = await getTaskForOrg(taskId, membership);
  if (!task) return;

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.taskComment.create({
    data: { taskId, authorId: session.user.id, body },
  });

  revalidatePath(`/dashboard/projects/${task.projectId}/tasks/${taskId}/edit`);
}

async function deleteComment(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const commentId = String(formData.get("commentId") ?? "");
  const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.authorId !== session.user.id) return;

  // Re-derive the task through getTaskForOrg rather than trusting the
  // comment's own taskId/org link, so a comment somehow left behind on a
  // task the requester can no longer see still can't be deleted from here.
  const task = await getTaskForOrg(comment.taskId, membership);
  if (!task) return;

  await prisma.taskComment.delete({ where: { id: commentId } });

  revalidatePath(`/dashboard/projects/${task.projectId}/tasks/${task.id}/edit`);
}

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const project = await getProjectForOrg(id, membership);
  if (!project) notFound();

  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) notFound();

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: membership.organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const comments = await prisma.taskComment.findMany({
    where: { taskId: task.id },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit task</h1>

      <form action={updateTask} className="flex flex-col gap-4">
        <input type="hidden" name="taskId" value={task.id} />

        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={task.title}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <input
            id="description"
            name="description"
            defaultValue={task.description ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={task.status}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="TODO">Todo</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="assigneeId" className="text-sm font-medium">
            Assignee
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={task.assigneeId ?? ""}
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
          <label htmlFor="dueDate" className="text-sm font-medium">
            Due date
          </label>
          <input
            id="dueDate"
            type="date"
            name="dueDate"
            defaultValue={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Save
          </button>
          <a
            href={`/dashboard/projects/${project.id}`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </a>
        </div>
      </form>

      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6">
        <h2 className="text-sm font-medium text-gray-500">Comments</h2>

        <div className="flex flex-col gap-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-1 rounded-md border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  {comment.author.name ?? comment.author.email}
                </span>
                <span className="text-xs text-gray-400">{comment.createdAt.toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
              {comment.authorId === session.user.id && (
                <form action={deleteComment} className="self-end">
                  <input type="hidden" name="commentId" value={comment.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              )}
            </div>
          ))}
          {comments.length === 0 && <p className="text-xs text-gray-400">No comments yet.</p>}
        </div>

        <form action={addComment} className="flex flex-col gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Add a comment…"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            className="w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Post comment
          </button>
        </form>
      </section>
    </div>
  );
}
