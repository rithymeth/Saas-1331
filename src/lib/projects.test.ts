import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { getProjectForOrg, getTaskForOrg } from "./projects";

describe("cross-organization isolation for projects and tasks", () => {
  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let taskAId: string;

  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: "Org A", slug: `org-a-${Date.now()}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: "Org B", slug: `org-b-${Date.now()}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const project = await prisma.project.create({
      data: { organizationId: orgAId, name: "Org A's project" },
    });
    projectAId = project.id;

    const task = await prisma.task.create({
      data: { projectId: projectAId, title: "Org A's task" },
    });
    taskAId = task.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: orgAId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: orgBId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("returns the project when it belongs to the requesting org", async () => {
    const project = await getProjectForOrg(projectAId, orgAId);
    expect(project?.id).toBe(projectAId);
  });

  it("returns null for a real project ID that belongs to a different org", async () => {
    // This is the actual attack this check exists to stop: a member of Org B
    // guessing or otherwise obtaining Org A's project ID and requesting it.
    const project = await getProjectForOrg(projectAId, orgBId);
    expect(project).toBeNull();
  });

  it("returns null for a nonexistent project ID", async () => {
    const project = await getProjectForOrg("does-not-exist", orgAId);
    expect(project).toBeNull();
  });

  it("returns the task when its project belongs to the requesting org", async () => {
    const task = await getTaskForOrg(taskAId, orgAId);
    expect(task?.id).toBe(taskAId);
  });

  it("returns null for a real task ID that belongs to a different org", async () => {
    const task = await getTaskForOrg(taskAId, orgBId);
    expect(task).toBeNull();
  });
});
