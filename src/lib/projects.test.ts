import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { getProjectForOrg, getTaskForOrg } from "./projects";

describe("cross-organization isolation for projects and tasks", () => {
  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let taskAId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: "Org A", slug: `org-a-${Date.now()}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: "Org B", slug: `org-b-${Date.now()}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userA = await prisma.user.create({ data: { email: `user-a-${Date.now()}@example.com` } });
    const userB = await prisma.user.create({ data: { email: `user-b-${Date.now()}@example.com` } });
    userAId = userA.id;
    userBId = userB.id;
    await prisma.organizationMember.create({
      data: { userId: userAId, organizationId: orgAId, role: "MEMBER" },
    });
    await prisma.organizationMember.create({
      data: { userId: userBId, organizationId: orgBId, role: "MEMBER" },
    });

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
    await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("returns the project when it belongs to the requesting org", async () => {
    const project = await getProjectForOrg(projectAId, {
      userId: userAId,
      organizationId: orgAId,
      role: "MEMBER",
    });
    expect(project?.id).toBe(projectAId);
  });

  it("returns null for a real project ID that belongs to a different org", async () => {
    // This is the actual attack this check exists to stop: a member of Org B
    // guessing or otherwise obtaining Org A's project ID and requesting it.
    const project = await getProjectForOrg(projectAId, {
      userId: userBId,
      organizationId: orgBId,
      role: "MEMBER",
    });
    expect(project).toBeNull();
  });

  it("returns null for a nonexistent project ID", async () => {
    const project = await getProjectForOrg("does-not-exist", {
      userId: userAId,
      organizationId: orgAId,
      role: "MEMBER",
    });
    expect(project).toBeNull();
  });

  it("returns the task when its project belongs to the requesting org", async () => {
    const task = await getTaskForOrg(taskAId, { userId: userAId, organizationId: orgAId, role: "MEMBER" });
    expect(task?.id).toBe(taskAId);
  });

  it("returns null for a real task ID that belongs to a different org", async () => {
    const task = await getTaskForOrg(taskAId, { userId: userBId, organizationId: orgBId, role: "MEMBER" });
    expect(task).toBeNull();
  });
});

describe("project-level membership restrictions", () => {
  let orgId: string;
  let memberInId: string;
  let memberOutId: string;
  let ownerId: string;
  let restrictedProjectId: string;
  let openProjectId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: "Restricted Org", slug: `restricted-org-${Date.now()}` },
    });
    orgId = org.id;

    const memberIn = await prisma.user.create({ data: { email: `member-in-${Date.now()}@example.com` } });
    const memberOut = await prisma.user.create({ data: { email: `member-out-${Date.now()}@example.com` } });
    const owner = await prisma.user.create({ data: { email: `owner-${Date.now()}@example.com` } });
    memberInId = memberIn.id;
    memberOutId = memberOut.id;
    ownerId = owner.id;

    await prisma.organizationMember.createMany({
      data: [
        { userId: memberInId, organizationId: orgId, role: "MEMBER" },
        { userId: memberOutId, organizationId: orgId, role: "MEMBER" },
        { userId: ownerId, organizationId: orgId, role: "OWNER" },
      ],
    });

    const restrictedProject = await prisma.project.create({
      data: { organizationId: orgId, name: "Restricted project" },
    });
    restrictedProjectId = restrictedProject.id;
    await prisma.projectMember.create({ data: { projectId: restrictedProjectId, userId: memberInId } });

    const openProject = await prisma.project.create({
      data: { organizationId: orgId, name: "Open project" },
    });
    openProjectId = openProject.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.user.delete({ where: { id: memberInId } }).catch(() => {});
    await prisma.user.delete({ where: { id: memberOutId } }).catch(() => {});
    await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
  });

  it("lets a listed member access a restricted project", async () => {
    const project = await getProjectForOrg(restrictedProjectId, {
      userId: memberInId,
      organizationId: orgId,
      role: "MEMBER",
    });
    expect(project?.id).toBe(restrictedProjectId);
  });

  it("denies a member who isn't on the restricted project's list", async () => {
    const project = await getProjectForOrg(restrictedProjectId, {
      userId: memberOutId,
      organizationId: orgId,
      role: "MEMBER",
    });
    expect(project).toBeNull();
  });

  it("lets an owner access a restricted project even without an explicit membership row", async () => {
    const project = await getProjectForOrg(restrictedProjectId, {
      userId: ownerId,
      organizationId: orgId,
      role: "OWNER",
    });
    expect(project?.id).toBe(restrictedProjectId);
  });

  it("leaves a project with no membership rows open to any org member", async () => {
    const project = await getProjectForOrg(openProjectId, {
      userId: memberOutId,
      organizationId: orgId,
      role: "MEMBER",
    });
    expect(project?.id).toBe(openProjectId);
  });
});
