import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppUrlFromEnv,
  getGoogleProviderConfig,
  getStripeWebhookSecret,
  requireAuthSecret,
  resolveAppUrl,
} from "./env";

describe("environment helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes NEXT_PUBLIC_APP_URL to its origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/dashboard");
    expect(getAppUrlFromEnv()).toBe("https://example.com");
  });

  it("falls back to the request origin in development", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    await expect(resolveAppUrl(new Request("http://localhost:3000/test"))).resolves.toBe(
      "http://localhost:3000"
    );
  });

  it("refuses to build secret-bearing URLs from request data in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    await expect(resolveAppUrl(new Request("https://attacker.example/reset"))).rejects.toThrow(
      /NEXT_PUBLIC_APP_URL must be set/
    );
  });

  it("requires AUTH_SECRET in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");

    expect(() => requireAuthSecret()).toThrow(/AUTH_SECRET must be set/);
  });

  it("requires Google OAuth credentials to be configured as a pair", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    expect(() => getGoogleProviderConfig()).toThrow(/Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
  });

  it("requires Stripe webhook signing to be configured consistently", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");

    expect(() => getStripeWebhookSecret()).toThrow(/STRIPE_WEBHOOK_SECRET requires STRIPE_SECRET_KEY/);
  });
});
