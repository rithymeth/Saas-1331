import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows requests up to the limit, then blocks", async () => {
    const key = `test-limit:${Date.now()}`;
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await checkRateLimit(key, 3));
    }
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("tracks different keys independently", async () => {
    const keyA = `test-a:${Date.now()}`;
    const keyB = `test-b:${Date.now()}`;
    expect(await checkRateLimit(keyA, 1)).toBe(true);
    expect(await checkRateLimit(keyA, 1)).toBe(false);
    expect(await checkRateLimit(keyB, 1)).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers the first entry in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "9.8.7.6" });
    expect(getClientIp(headers)).toBe("9.8.7.6");
  });

  it("falls back to \"unknown\" when neither header is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
