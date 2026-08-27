import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const KEY_PREFIX = "sk_live_";

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Returns the full key (shown once) alongside the created record. */
export async function createApiKey(input: {
  organizationId: string;
  name: string;
  createdByEmail: string;
}) {
  const secret = crypto.randomBytes(24).toString("hex");
  const key = `${KEY_PREFIX}${secret}`;

  const record = await prisma.apiKey.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      createdByEmail: input.createdByEmail,
      keyPrefix: key.slice(0, KEY_PREFIX.length + 8),
      keyHash: hashKey(key),
    },
  });

  return { key, record };
}

/** Validates a bearer key and returns its (non-revoked) organization, or null. */
export async function getOrganizationForApiKey(key: string) {
  if (!key.startsWith(KEY_PREFIX)) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(key) },
    include: { organization: true },
  });
  if (!apiKey || apiKey.revokedAt) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey.organization;
}
