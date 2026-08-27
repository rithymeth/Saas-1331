import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { stripe, STRIPE_PRICE_ID } from "@/lib/stripe";

function appUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!stripe || !STRIPE_PRICE_ID) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 501 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || membership.role === "MEMBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.subscription.findUnique({
    where: { organizationId: membership.organizationId },
  });

  const customerId =
    existing?.stripeCustomerId ??
    (
      await stripe.customers.create({
        email: session.user.email ?? undefined,
        name: membership.organization.name,
        metadata: { organizationId: membership.organizationId },
      })
    ).id;

  if (!existing) {
    await prisma.subscription.create({
      data: { organizationId: membership.organizationId, stripeCustomerId: customerId },
    });
  }

  const base = appUrl(request);
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${base}/dashboard/billing?success=1`,
    cancel_url: `${base}/dashboard/billing?canceled=1`,
    client_reference_id: membership.organizationId,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
