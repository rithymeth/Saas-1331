import { describe, it, expect, afterEach } from "vitest";
import { isSuperAdmin } from "./admin";

describe("isSuperAdmin", () => {
  const original = process.env.SUPER_ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.SUPER_ADMIN_EMAILS;
    else process.env.SUPER_ADMIN_EMAILS = original;
  });

  it("returns false when unset", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(isSuperAdmin("owner@example.com")).toBe(false);
  });

  it("returns false for null/undefined email", () => {
    process.env.SUPER_ADMIN_EMAILS = "owner@example.com";
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });

  it("matches a listed email", () => {
    process.env.SUPER_ADMIN_EMAILS = "owner@example.com,second@example.com";
    expect(isSuperAdmin("owner@example.com")).toBe(true);
    expect(isSuperAdmin("second@example.com")).toBe(true);
  });

  it("is case-insensitive and trims whitespace in the list", () => {
    process.env.SUPER_ADMIN_EMAILS = " Owner@Example.com , second@example.com";
    expect(isSuperAdmin("owner@example.com")).toBe(true);
    expect(isSuperAdmin("OWNER@EXAMPLE.COM")).toBe(true);
  });

  it("rejects an email not in the list", () => {
    process.env.SUPER_ADMIN_EMAILS = "owner@example.com";
    expect(isSuperAdmin("someone-else@example.com")).toBe(false);
  });
});
