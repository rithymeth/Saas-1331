import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { stripe } from "@/lib/stripe";
import { PLANS, getPlan } from "@/lib/plans";

function appUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!stripe || PLANS.length === 0) {
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

  const body = await request.json().catch(() => ({}));
  const plan = getPlan(String(body.planId ?? "")) ?? PLANS[0];

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

  const seats = await prisma.organizationMember.count({
    where: { organizationId: membership.organizationId },
  });

  const base = appUrl(request);
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.priceId, quantity: seats }],
    success_url: `${base}/dashboard/billing?success=1`,
    cancel_url: `${base}/dashboard/billing?canceled=1`,
    client_reference_id: membership.organizationId,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
