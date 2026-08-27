import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEYS = ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO", "STRIPE_PRICE_ID"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

async function loadPlans() {
  vi.resetModules();
  return import("./plans");
}

describe("plans", () => {
  it("is empty when nothing is configured", async () => {
    const { PLANS } = await loadPlans();
    expect(PLANS).toEqual([]);
  });

  it("builds named plans from STRIPE_PRICE_STARTER/STRIPE_PRICE_PRO", async () => {
    process.env.STRIPE_PRICE_STARTER = "price_starter";
    process.env.STRIPE_PRICE_PRO = "price_pro";
    const { PLANS, getPlan, getPlanByPriceId } = await loadPlans();

    expect(PLANS).toEqual([
      { id: "starter", name: "Starter", priceId: "price_starter" },
      { id: "pro", name: "Pro", priceId: "price_pro" },
    ]);
    expect(getPlan("pro")?.priceId).toBe("price_pro");
    expect(getPlanByPriceId("price_starter")?.id).toBe("starter");
    expect(getPlanByPriceId("unknown")).toBeUndefined();
  });

  it("falls back to a single default plan from STRIPE_PRICE_ID", async () => {
    process.env.STRIPE_PRICE_ID = "price_legacy";
    const { PLANS } = await loadPlans();
    expect(PLANS).toEqual([{ id: "default", name: "Pro", priceId: "price_legacy" }]);
  });

  it("ignores STRIPE_PRICE_ID once named plans are configured", async () => {
    process.env.STRIPE_PRICE_STARTER = "price_starter";
    process.env.STRIPE_PRICE_ID = "price_legacy";
    const { PLANS } = await loadPlans();
    expect(PLANS).toEqual([{ id: "starter", name: "Starter", priceId: "price_starter" }]);
  });
});
