import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./prisma";
import { createToken, consumeToken } from "./tokens";

describe("tokens", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a token that can be consumed exactly once", async () => {
    const identifier = `test:${Date.now()}`;
    const raw = await createToken(identifier, 60_000);

    const first = await consumeToken(raw);
    expect(first).toBe(identifier);

    const second = await consumeToken(raw);
    expect(second).toBeNull();
  });

  it("rejects an unknown token", async () => {
    const result = await consumeToken("not-a-real-token");
    expect(result).toBeNull();
  });

  it("rejects an expired token", async () => {
    const identifier = `test-expired:${Date.now()}`;
    const raw = await createToken(identifier, -1000);

    const result = await consumeToken(raw);
    expect(result).toBeNull();
  });

  it("invalidates a prior token for the same identifier when a new one is issued", async () => {
    const identifier = `test-reissue:${Date.now()}`;
    const first = await createToken(identifier, 60_000);
    const second = await createToken(identifier, 60_000);

    expect(await consumeToken(first)).toBeNull();
    expect(await consumeToken(second)).toBe(identifier);
  });
});
