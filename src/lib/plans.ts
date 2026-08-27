export type Plan = { id: string; name: string; priceId: string };

function plansFromEnv(): Plan[] {
  const plans: Plan[] = [];
  if (process.env.STRIPE_PRICE_STARTER) {
    plans.push({ id: "starter", name: "Starter", priceId: process.env.STRIPE_PRICE_STARTER });
  }
  if (process.env.STRIPE_PRICE_PRO) {
    plans.push({ id: "pro", name: "Pro", priceId: process.env.STRIPE_PRICE_PRO });
  }
  // Back-compat: a single STRIPE_PRICE_ID still works as one plan when the
  // named STRIPE_PRICE_STARTER/STRIPE_PRICE_PRO vars aren't set.
  if (plans.length === 0 && process.env.STRIPE_PRICE_ID) {
    plans.push({ id: "default", name: "Pro", priceId: process.env.STRIPE_PRICE_ID });
  }
  return plans;
}

export const PLANS = plansFromEnv();

export function getPlan(id: string) {
  return PLANS.find((p) => p.id === id);
}

export function getPlanByPriceId(priceId: string | null | undefined) {
  return PLANS.find((p) => p.priceId === priceId);
}
