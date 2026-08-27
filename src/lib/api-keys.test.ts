import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "./prisma";
import { createApiKey, authenticateApiKey } from "./api-keys";

describe("api-keys", () => {
  let organizationId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: "API Key Test Org", slug: `api-key-test-${Date.now()}` },
    });
    organizationId = org.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  afterEach(() => {
    delete process.env.API_KEY_RATE_LIMIT_READ_PER_MINUTE;
  });

  it("authenticates a freshly created key and returns its organization", async () => {
    const { key } = await createApiKey({
      organizationId,
      name: "test key",
      createdByEmail: "owner@example.com",
      scopes: ["read"],
    });

    const result = await authenticateApiKey(key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.organization.id).toBe(organizationId);
    }
  });

  it("rejects a key with the wrong prefix", async () => {
    const result = await authenticateApiKey("not-a-real-key");
    expect(result).toEqual({ ok: false, status: 401, error: "Invalid API key" });
  });

  it("rejects an unknown key", async () => {
    const result = await authenticateApiKey("sk_live_" + "0".repeat(48));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects a revoked key", async () => {
    const { key, record } = await createApiKey({
      organizationId,
      name: "revoked key",
      createdByEmail: "owner@example.com",
      scopes: ["read"],
    });
    await prisma.apiKey.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    const result = await authenticateApiKey(key);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("enforces a required scope", async () => {
    const { key } = await createApiKey({
      organizationId,
      name: "write only",
      createdByEmail: "owner@example.com",
      scopes: ["write"],
    });

    const result = await authenticateApiKey(key, { requiredScope: "read" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toContain("read");
    }
  });

  it("blocks a key belonging to a suspended organization", async () => {
    const suspendedOrg = await prisma.organization.create({
      data: {
        name: "Suspended Org",
        slug: `suspended-test-${Date.now()}`,
        suspendedAt: new Date(),
      },
    });
    const { key } = await createApiKey({
      organizationId: suspendedOrg.id,
      name: "key on suspended org",
      createdByEmail: "owner@example.com",
      scopes: ["read"],
    });

    const result = await authenticateApiKey(key);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/suspended/i);
    }

    await prisma.organization.delete({ where: { id: suspendedOrg.id } });
  });

  it("rate-limits a scope independently once its limit is exceeded", async () => {
    process.env.API_KEY_RATE_LIMIT_READ_PER_MINUTE = "3";
    const { key } = await createApiKey({
      organizationId,
      name: "rate limited key",
      createdByEmail: "owner@example.com",
      scopes: ["read"],
    });

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await authenticateApiKey(key, { requiredScope: "read" }));
    }

    expect(results.slice(0, 3).every((r) => r.ok)).toBe(true);
    const fourth = results[3];
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.status).toBe(429);
  });
});
