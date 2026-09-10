import crypto from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { deleteOrganization } from "./organizations";

const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

async function createOrganizationFixture(options?: {
  suspended?: boolean;
  subscriptionStatus?: SubscriptionStatus;
}) {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`;
  const user = await prisma.user.create({ data: { email: `org-owner-${suffix}@example.com` } });
  createdUserIds.push(user.id);

  const organization = await prisma.organization.create({
    data: {
      name: `Org ${suffix}`,
      slug: `org-${suffix}`,
      suspendedAt: options?.suspended ? new Date() : null,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
      invitations: {
        create: {
          email: `invite-${suffix}@example.com`,
          role: "MEMBER",
          token: `invite-${suffix}`,
          invitedByEmail: user.email,
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
      apiKeys: {
        create: {
          name: "Primary",
          keyPrefix: "sk_live_test",
          keyHash: crypto.createHash("sha256").update(`key-${suffix}`).digest("hex"),
          scopes: ["read", "write"],
          createdByEmail: user.email,
        },
      },
      projects: {
        create: {
          name: "Roadmap",
          tasks: {
            create: {
              title: "Ship update",
            },
          },
        },
      },
      ...(options?.subscriptionStatus
        ? {
            subscription: {
              create: {
                stripeCustomerId: `cus_${suffix}`,
                stripeSubscriptionId: `sub_${suffix}`,
                stripePriceId: "price_default",
                status: options.subscriptionStatus,
              },
            },
          }
        : {}),
    },
  });

  createdOrgIds.push(organization.id);
  return organization;
}

describe("deleteOrganization", () => {
  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("requires an exact slug confirmation", async () => {
    const organization = await createOrganizationFixture({ suspended: true });

    await expect(
      deleteOrganization({ organizationId: organization.id, confirmation: `${organization.slug}-wrong` })
    ).resolves.toEqual({ ok: false, reason: "confirmation_mismatch" });
  });

  it("requires the organization to be suspended first", async () => {
    const organization = await createOrganizationFixture();

    await expect(
      deleteOrganization({ organizationId: organization.id, confirmation: organization.slug })
    ).resolves.toEqual({ ok: false, reason: "must_suspend_first" });
  });

  it("blocks deletion while billing is still active", async () => {
    const organization = await createOrganizationFixture({
      suspended: true,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });

    await expect(
      deleteOrganization({ organizationId: organization.id, confirmation: organization.slug })
    ).resolves.toEqual({ ok: false, reason: "active_subscription" });
  });

  it("deletes the organization and cascades related records once safeguards pass", async () => {
    const organization = await createOrganizationFixture({
      suspended: true,
      subscriptionStatus: SubscriptionStatus.CANCELED,
    });

    await expect(
      deleteOrganization({ organizationId: organization.id, confirmation: organization.slug })
    ).resolves.toEqual({ ok: true, slug: organization.slug });

    await expect(prisma.organization.findUnique({ where: { id: organization.id } })).resolves.toBeNull();
    await expect(
      prisma.organizationMember.count({ where: { organizationId: organization.id } })
    ).resolves.toBe(0);
    await expect(prisma.invitation.count({ where: { organizationId: organization.id } })).resolves.toBe(0);
    await expect(prisma.apiKey.count({ where: { organizationId: organization.id } })).resolves.toBe(0);
    await expect(prisma.project.count({ where: { organizationId: organization.id } })).resolves.toBe(0);
    await expect(
      prisma.subscription.count({ where: { organizationId: organization.id } })
    ).resolves.toBe(0);
  });
});
