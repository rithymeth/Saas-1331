import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/org";
import { createApiKey, type ApiKeyScope } from "@/lib/api-keys";
import { ApiKeyCreateForm } from "@/components/api-key-create-form";

async function createKey(_prevState: { key?: string; error?: string }, formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership || membership.role === "MEMBER") {
    return { error: "Only owners and admins can create API keys" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };

  const scopes = formData.getAll("scopes") as ApiKeyScope[];

  const { key } = await createApiKey({
    organizationId: membership.organizationId,
    name,
    createdByEmail: session.user.email ?? "",
    scopes,
  });

  revalidatePath("/dashboard/api-keys");
  return { key };
}

async function revokeKey(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership || membership.role === "MEMBER") return;

  const keyId = String(formData.get("keyId") ?? "");
  await prisma.apiKey.updateMany({
    where: { id: keyId, organizationId: membership.organizationId },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/dashboard/api-keys");
}

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getActiveMembership(session.user.id);
  if (!membership) redirect("/dashboard");

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const canManage = membership.role !== "MEMBER";

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">API keys</h1>
      <p className="text-sm text-gray-600">
        Use a key as a bearer token: <code>Authorization: Bearer sk_live_...</code> against{" "}
        <code>/api/v1/*</code> routes. Keys are limited to{" "}
        {process.env.API_KEY_RATE_LIMIT_PER_MINUTE ?? 60} requests/minute.
      </p>

      {canManage && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-500">Create a key</h2>
          <ApiKeyCreateForm action={createKey} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">Keys</h2>
        <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
          {keys.map((apiKey) => (
            <div key={apiKey.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {apiKey.name} <span className="text-gray-400">· {apiKey.scopes.join(", ")}</span>
                </p>
                <p className="text-xs text-gray-500">
                  <code>{apiKey.keyPrefix}…</code> · created {apiKey.createdAt.toLocaleDateString()}
                  {apiKey.lastUsedAt && ` · last used ${apiKey.lastUsedAt.toLocaleDateString()}`}
                  {apiKey.revokedAt && " · revoked"}
                </p>
              </div>
              {canManage && !apiKey.revokedAt && (
                <form action={revokeKey}>
                  <input type="hidden" name="keyId" value={apiKey.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Revoke
                  </button>
                </form>
              )}
            </div>
          ))}
          {keys.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500">No API keys yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
