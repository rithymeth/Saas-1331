import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const KEY_PREFIX = "sk_live_";

export const API_KEY_SCOPES = ["read", "write"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const DEFAULT_RATE_LIMIT_PER_MINUTE = Number(process.env.API_KEY_RATE_LIMIT_PER_MINUTE ?? 60);

function rateLimitFor(scope?: ApiKeyScope) {
  if (scope === "write") {
    return Number(process.env.API_KEY_RATE_LIMIT_WRITE_PER_MINUTE ?? DEFAULT_RATE_LIMIT_PER_MINUTE);
  }
  if (scope === "read") {
    return Number(process.env.API_KEY_RATE_LIMIT_READ_PER_MINUTE ?? DEFAULT_RATE_LIMIT_PER_MINUTE);
  }
  return DEFAULT_RATE_LIMIT_PER_MINUTE;
}

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Returns the full key (shown once) alongside the created record. */
export async function createApiKey(input: {
  organizationId: string;
  name: string;
  createdByEmail: string;
  scopes: ApiKeyScope[];
}) {
  const secret = crypto.randomBytes(24).toString("hex");
  const key = `${KEY_PREFIX}${secret}`;
  const scopes = input.scopes.filter((s) => API_KEY_SCOPES.includes(s));

  const record = await prisma.apiKey.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      createdByEmail: input.createdByEmail,
      keyPrefix: key.slice(0, KEY_PREFIX.length + 8),
      keyHash: hashKey(key),
      scopes: scopes.length > 0 ? scopes : ["read"],
    },
  });

  return { key, record };
}

export type ApiKeyAuthResult =
  | { ok: true; organization: { id: string; name: string; slug: string } }
  | { ok: false; status: 401 | 403 | 429; error: string };

/**
 * Validates a bearer key: checks it's not revoked, its org isn't suspended,
 * it has the required scope, and hasn't exceeded its per-minute rate limit
 * (tracked separately per scope). Records usage as a side effect.
 */
export async function authenticateApiKey(
  key: string,
  options?: { requiredScope?: ApiKeyScope }
): Promise<ApiKeyAuthResult> {
  if (!key.startsWith(KEY_PREFIX)) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(key) },
    include: { organization: true },
  });
  if (!apiKey || apiKey.revokedAt) {
    return { ok: false, status: 401, error: "Invalid or revoked API key" };
  }

  if (apiKey.organization.suspendedAt) {
    return { ok: false, status: 403, error: "This organization has been suspended" };
  }

  if (options?.requiredScope && !apiKey.scopes.includes(options.requiredScope)) {
    return { ok: false, status: 403, error: `This key is missing the "${options.requiredScope}" scope` };
  }

  const scope = options?.requiredScope ?? "default";
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const usage = await prisma.apiKeyUsage.upsert({
    where: { apiKeyId_scope_windowStart: { apiKeyId: apiKey.id, scope, windowStart } },
    create: { apiKeyId: apiKey.id, scope, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  if (usage.count > rateLimitFor(options?.requiredScope)) {
    return { ok: false, status: 429, error: "Rate limit exceeded" };
  }

  return {
    ok: true,
    organization: {
      id: apiKey.organization.id,
      name: apiKey.organization.name,
      slug: apiKey.organization.slug,
    },
  };
}
