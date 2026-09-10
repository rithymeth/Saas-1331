import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BLOCKING_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.INCOMPLETE,
  SubscriptionStatus.UNPAID,
]);

export type DeleteOrganizationResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "not_found" | "confirmation_mismatch" | "must_suspend_first" | "active_subscription" };

export async function deleteOrganization(input: {
  organizationId: string;
  confirmation: string;
}): Promise<DeleteOrganizationResult> {
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    include: { subscription: true },
  });
  if (!organization) return { ok: false, reason: "not_found" };

  if (input.confirmation.trim() !== organization.slug) {
    return { ok: false, reason: "confirmation_mismatch" };
  }

  if (!organization.suspendedAt) {
    return { ok: false, reason: "must_suspend_first" };
  }

  if (
    organization.subscription &&
    BLOCKING_SUBSCRIPTION_STATUSES.has(organization.subscription.status)
  ) {
    return { ok: false, reason: "active_subscription" };
  }

  await prisma.organization.delete({ where: { id: organization.id } });
  return { ok: true, slug: organization.slug };
}
