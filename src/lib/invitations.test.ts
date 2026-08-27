import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { createInvitation } from "./invitations";

describe("createInvitation", () => {
  let organizationId: string;
  let organizationName: string;

  beforeAll(async () => {
    organizationName = "Invitation Test Org";
    const org = await prisma.organization.create({
      data: { name: organizationName, slug: `invitation-test-${Date.now()}` },
    });
    organizationId = org.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("creates a pending invitation for a new email", async () => {
    const email = `invitee-${Date.now()}@example.com`;
    const result = await createInvitation({
      organizationId,
      organizationName,
      email,
      role: "MEMBER",
      invitedByEmail: "owner@example.com",
      appUrl: "http://localhost:3000",
    });

    expect(result).toEqual({ ok: true });

    const invitation = await prisma.invitation.findUnique({
      where: { email_organizationId: { email, organizationId } },
    });
    expect(invitation).not.toBeNull();
    expect(invitation?.role).toBe("MEMBER");
    expect(invitation?.token).toHaveLength(48);
  });

  it("re-inviting the same email replaces the token instead of duplicating", async () => {
    const email = `repeat-invitee-${Date.now()}@example.com`;
    await createInvitation({
      organizationId,
      organizationName,
      email,
      role: "MEMBER",
      invitedByEmail: "owner@example.com",
      appUrl: "http://localhost:3000",
    });
    const first = await prisma.invitation.findUnique({
      where: { email_organizationId: { email, organizationId } },
    });

    await createInvitation({
      organizationId,
      organizationName,
      email,
      role: "ADMIN",
      invitedByEmail: "owner@example.com",
      appUrl: "http://localhost:3000",
    });
    const second = await prisma.invitation.findUnique({
      where: { email_organizationId: { email, organizationId } },
    });

    expect(second?.role).toBe("ADMIN");
    expect(second?.token).not.toBe(first?.token);

    const count = await prisma.invitation.count({ where: { email, organizationId } });
    expect(count).toBe(1);
  });

  it("refuses to invite someone who is already a member", async () => {
    const email = `existing-member-${Date.now()}@example.com`;
    const user = await prisma.user.create({ data: { email, name: "Existing Member" } });
    await prisma.organizationMember.create({
      data: { userId: user.id, organizationId, role: "MEMBER" },
    });

    const result = await createInvitation({
      organizationId,
      organizationName,
      email,
      role: "MEMBER",
      invitedByEmail: "owner@example.com",
      appUrl: "http://localhost:3000",
    });

    expect(result).toEqual({ ok: false, reason: "already_member" });

    await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
