import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { stripe } from "@/lib/stripe";

function appUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!stripe) {
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

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: membership.organizationId },
  });
  if (!subscription) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl(request)}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
