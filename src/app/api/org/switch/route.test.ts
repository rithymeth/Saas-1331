import { afterEach, describe, expect, it, vi } from "vitest";

const { auth, findUnique, setCookie } = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: {
      findUnique,
    },
  },
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: setCookie,
  })),
}));

import { POST } from "./route";

describe("POST /api/org/switch", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not signed in", async () => {
    auth.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/org/switch", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid request bodies", async () => {
    auth.mockResolvedValue({ user: { id: "user_1" } });

    const response = await POST(
      new Request("http://localhost/api/org/switch", {
        method: "POST",
        body: JSON.stringify({ organizationId: 123 }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid input" });
  });

  it("sets the active organization cookie for valid memberships", async () => {
    auth.mockResolvedValue({ user: { id: "user_1" } });
    findUnique.mockResolvedValue({ id: "membership_1" });

    const response = await POST(
      new Request("http://localhost/api/org/switch", {
        method: "POST",
        body: JSON.stringify({ organizationId: "org_1" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(setCookie).toHaveBeenCalledWith(
      "activeOrgId",
      "org_1",
      expect.objectContaining({
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      })
    );
  });
});
