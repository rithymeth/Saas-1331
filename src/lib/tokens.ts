import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a single-use token for the given identifier (e.g. `pwreset:<email>`),
 * invalidating any prior tokens for it. Returns the raw token — only its hash
 * is stored, so this is the only place the raw value is ever available.
 */
export async function createToken(identifier: string, ttlMs: number) {
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: { identifier, token: hashToken(raw), expires: new Date(Date.now() + ttlMs) },
  });

  return raw;
}

/** Validates and consumes a raw token, returning its identifier or null if invalid/expired. */
export async function consumeToken(raw: string) {
  const record = await prisma.verificationToken.findUnique({ where: { token: hashToken(raw) } });
  if (!record || record.expires < new Date()) return null;

  await prisma.verificationToken.delete({ where: { token: record.token } });
  return record.identifier;
}
