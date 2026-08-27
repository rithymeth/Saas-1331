import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveAppUrl } from "./url";

describe("resolveAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns NEXT_PUBLIC_APP_URL when it's set", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    await expect(resolveAppUrl()).resolves.toBe("https://example.com");
  });

  it("refuses to fall back to the request's Host header in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    // The Host header is attacker-controllable, so trusting it to build links
    // that carry secrets (password resets, email verification, invites) would
    // let an attacker redirect those links to a domain they control.
    await expect(resolveAppUrl()).rejects.toThrow(/NEXT_PUBLIC_APP_URL must be set/);
  });
});
