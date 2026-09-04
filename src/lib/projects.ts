import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

type Membership = { userId: string; organizationId: string; role: Role };

function isPrivileged(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Prisma `where` fragment restricting a Project query to ones the given user
 * is allowed to see: projects with no members restriction (open to the whole
 * org) plus ones they've been explicitly added to. Owners/admins always see
 * every project in the org, restricted or not.
 */
export function projectVisibilityFilter(userId: string, role: Role) {
  if (isPrivileged(role)) return {};
  return {
    OR: [{ members: { none: {} } }, { members: { some: { userId } } }],
  };
}

/**
 * Returns the project (with its tasks and members) only if it belongs to the
 * requesting membership's organization and, when the project has been
 * restricted to specific members, the requester is one of them (or an
 * owner/admin). Prevents cross-org access via a guessed/known project ID,
 * and enforces per-project membership restrictions the same way.
 */
export async function getProjectForOrg(projectId: string, membership: Membership) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: { include: { assignee: true }, orderBy: { createdAt: "asc" } },
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!project || project.organizationId !== membership.organizationId) return null;
  if (
    project.members.length > 0 &&
    !isPrivileged(membership.role) &&
    !project.members.some((m) => m.userId === membership.userId)
  ) {
    return null;
  }
  return project;
}

/** Returns the task only if its project belongs to the org and is visible to the requester (see getProjectForOrg). */
export async function getTaskForOrg(taskId: string, membership: Membership) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { members: true } } },
  });
  if (!task || task.project.organizationId !== membership.organizationId) return null;
  if (
    task.project.members.length > 0 &&
    !isPrivileged(membership.role) &&
    !task.project.members.some((m) => m.userId === membership.userId)
  ) {
    return null;
  }
  return task;
}
