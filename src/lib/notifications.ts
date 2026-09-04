import { prisma } from "@/lib/prisma";
import { sendTaskAssignedEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/url";

/** Notifies a task's new assignee by email. No-ops when assigning to yourself. */
export async function notifyTaskAssignment(input: {
  assigneeId: string;
  actorId: string;
  actorEmail: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
}) {
  if (input.assigneeId === input.actorId) return;

  const assignee = await prisma.user.findUnique({ where: { id: input.assigneeId } });
  if (!assignee) return;

  const appUrl = await resolveAppUrl();
  await sendTaskAssignedEmail({
    to: assignee.email,
    taskTitle: input.taskTitle,
    projectName: input.projectName,
    taskUrl: `${appUrl}/dashboard/projects/${input.projectId}/tasks/${input.taskId}/edit`,
    assignedByEmail: input.actorEmail,
  });
}
