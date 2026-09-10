import { afterEach, describe, expect, it, vi } from "vitest";

const getStripeWebhookSecret = vi.fn();
const constructEvent = vi.fn();
const retrieveSubscription = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/env", () => ({ getStripeWebhookSecret }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      updateMany,
    },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent,
    },
    subscriptions: {
      retrieve: retrieveSubscription,
    },
  },
}));

import { POST } from "./route";

describe("POST /api/webhooks/stripe", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 501 when webhook signing is not configured", async () => {
    getStripeWebhookSecret.mockReturnValue(undefined);

    const response = await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST" }));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "Billing is not configured" });
  });

  it("returns 400 for invalid webhook signatures", async () => {
    getStripeWebhookSecret.mockReturnValue("whsec_test");
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ hello: "world" }),
        headers: { "stripe-signature": "invalid" },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
  });

  it("syncs checkout-completed subscriptions into Prisma", async () => {
    getStripeWebhookSecret.mockReturnValue("whsec_test");
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { subscription: "sub_123" } },
    });
    retrieveSubscription.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [{ price: { id: "price_pro" } }] },
      status: "active",
      current_period_end: 1_725_897_600,
      cancel_at_period_end: false,
    });
    updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ id: "evt_123" }),
        headers: { "stripe-signature": "valid" },
      })
    );

    expect(response.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledWith("sub_123");
    expect(updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_123" },
      data: expect.objectContaining({
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_pro",
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
      }),
    });
  });
});
