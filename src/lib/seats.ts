import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * Syncs an organization's active Stripe subscription quantity to its current
 * member count. No-ops when billing isn't configured or there's no active
 * subscription yet — call this after any membership change.
 */
export async function syncSeatCount(organizationId: string) {
  if (!stripe) return;

  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!subscription?.stripeSubscriptionId) return;
  if (subscription.status !== "ACTIVE" && subscription.status !== "TRIALING") return;

  const memberCount = await prisma.organizationMember.count({ where: { organizationId } });

  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const item = stripeSubscription.items.data[0];
  if (!item) return;

  await stripe.subscriptionItems.update(item.id, { quantity: memberCount });
}
