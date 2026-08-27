import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./prisma";
import { jwtCallback } from "./session";

describe("jwtCallback — session invalidation on password change", () => {
  let userId: string;
  const email = `jwt-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email, password: "irrelevant-hash" } });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("embeds passwordChangedAt in the token at sign-in", async () => {
    const token = await jwtCallback({ token: {}, user: { email } });
    expect(token).not.toBeNull();
    expect(token!.userId).toBe(userId);
    expect(token!.passwordChangedAt ?? null).toBe(null); // no password change yet
  });

  it("leaves a valid token untouched on a later request", async () => {
    const signedInToken = await jwtCallback({ token: {}, user: { email } });
    const laterToken = await jwtCallback({ token: signedInToken! });
    expect(laterToken).not.toBeNull();
    expect(laterToken!.userId).toBe(userId);
  });

  it("invalidates the token once the password changes after it was issued", async () => {
    const signedInToken = await jwtCallback({ token: {}, user: { email } });

    await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: new Date() } });

    const laterToken = await jwtCallback({ token: signedInToken! });
    expect(laterToken).toBeNull();
  });

  it("a fresh sign-in after the password change gets a valid, up-to-date token", async () => {
    const freshToken = await jwtCallback({ token: {}, user: { email } });
    expect(freshToken).not.toBeNull();

    const laterToken = await jwtCallback({ token: freshToken! });
    expect(laterToken).not.toBeNull();
  });

  it("invalidates the token if the user no longer exists", async () => {
    const ghostUser = await prisma.user.create({
      data: { email: `ghost-${Date.now()}@example.com` },
    });
    const signedInToken = await jwtCallback({ token: {}, user: { email: ghostUser.email } });
    await prisma.user.delete({ where: { id: ghostUser.id } });

    const laterToken = await jwtCallback({ token: signedInToken! });
    expect(laterToken).toBeNull();
  });
});
