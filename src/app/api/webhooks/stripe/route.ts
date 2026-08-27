import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: SubscriptionStatus.ACTIVE,
  trialing: SubscriptionStatus.TRIALING,
  past_due: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  unpaid: SubscriptionStatus.UNPAID,
  paused: SubscriptionStatus.CANCELED,
};

async function syncSubscription(subscription: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeCustomerId: subscription.customer as string },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      status: STATUS_MAP[subscription.status],
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

export async function POST(request: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      if (checkoutSession.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          checkoutSession.subscription as string
        );
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
