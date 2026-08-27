import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { SubscribeButton, ManageBillingButton } from "@/components/billing-buttons";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  TRIALING: "Trialing",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
  INCOMPLETE: "Incomplete",
  INCOMPLETE_EXPIRED: "Incomplete (expired)",
  UNPAID: "Unpaid",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { success, canceled } = await searchParams;

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: membership.organizationId },
  });

  const billingConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
  const isActive = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";
  const canManage = membership.role !== "MEMBER";

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Subscription confirmed — thanks!
        </p>
      )}
      {canceled && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Checkout canceled.
        </p>
      )}

      {!billingConfigured ? (
        <p className="text-sm text-gray-500">
          Billing isn&apos;t configured yet. Set <code>STRIPE_SECRET_KEY</code> and{" "}
          <code>STRIPE_PRICE_ID</code> to enable subscriptions.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Plan status</p>
            <p className="text-lg">
              {subscription ? STATUS_LABEL[subscription.status] ?? subscription.status : "No subscription"}
            </p>
            {subscription?.currentPeriodEnd && (
              <p className="text-xs text-gray-500">
                {subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"} on{" "}
                {subscription.currentPeriodEnd.toLocaleDateString()}
              </p>
            )}
          </div>

          {canManage ? (
            isActive ? <ManageBillingButton /> : <SubscribeButton />
          ) : (
            <p className="text-xs text-gray-500">Only owners and admins can manage billing.</p>
          )}
        </div>
      )}
    </div>
  );
}
