import { headers } from "next/headers";

const DEFAULT_EMAIL_FROM = "onboarding@resend.dev";

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseAbsoluteHttpUrl(value: string, name: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http or https`);
  }

  return url.origin;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function requireAuthSecret() {
  const secret = readOptionalEnv("AUTH_SECRET");
  if (isProduction() && !secret) {
    throw new Error("AUTH_SECRET must be set in production.");
  }
  return secret;
}

export function getGoogleProviderConfig() {
  const clientId = readOptionalEnv("GOOGLE_CLIENT_ID");
  const clientSecret = readOptionalEnv("GOOGLE_CLIENT_SECRET");

  if (!!clientId !== !!clientSecret) {
    throw new Error("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or leave both unset.");
  }

  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getAppUrlFromEnv() {
  const appUrl = readOptionalEnv("NEXT_PUBLIC_APP_URL");
  return appUrl ? parseAbsoluteHttpUrl(appUrl, "NEXT_PUBLIC_APP_URL") : null;
}

export async function resolveAppUrl(request?: Request) {
  const configured = getAppUrlFromEnv();
  if (configured) return configured;

  if (request && !isProduction()) {
    return new URL(request.url).origin;
  }

  if (!isProduction()) {
    const host = (await headers()).get("host");
    if (host) return `http://${host}`;
  }

  throw new Error(
    "NEXT_PUBLIC_APP_URL must be set in production. Refusing to build a URL from request headers, which are attacker-controllable."
  );
}

export function getStripeSecretKey() {
  return readOptionalEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret() {
  const stripeSecretKey = getStripeSecretKey();
  const webhookSecret = readOptionalEnv("STRIPE_WEBHOOK_SECRET");

  if (webhookSecret && !stripeSecretKey) {
    throw new Error("STRIPE_WEBHOOK_SECRET requires STRIPE_SECRET_KEY.");
  }

  if (isProduction() && stripeSecretKey && !webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET must be set in production when Stripe billing is enabled.");
  }

  return webhookSecret;
}

export function getEmailConfig() {
  return {
    apiKey: readOptionalEnv("RESEND_API_KEY"),
    from: readOptionalEnv("EMAIL_FROM") ?? DEFAULT_EMAIL_FROM,
  };
}
