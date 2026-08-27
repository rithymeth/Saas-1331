import { prisma } from "@/lib/prisma";

/** Returns the project (with its tasks) only if it belongs to the given organization — prevents cross-org access via a guessed/known project ID. */
export async function getProjectForOrg(projectId: string, organizationId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tasks: { include: { assignee: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!project || project.organizationId !== organizationId) return null;
  return project;
}

/** Returns the task only if its project belongs to the given organization. */
export async function getTaskForOrg(taskId: string, organizationId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task || task.project.organizationId !== organizationId) return null;
  return task;
}
