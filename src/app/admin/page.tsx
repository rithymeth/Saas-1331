import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminOrganizationsPage() {
  const organizations = await prisma.organization.findMany({
    include: {
      _count: { select: { members: true } },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Organizations</h1>
      <p className="text-sm text-gray-500">{organizations.length} total</p>

      <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
        {organizations.map((org) => (
          <div key={org.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link href={`/admin/organizations/${org.id}`} className="text-sm font-medium hover:underline">
                {org.name}
              </Link>
              <p className="text-xs text-gray-500">
                {org.slug} · {org._count.members} member{org._count.members === 1 ? "" : "s"} ·
                created {org.createdAt.toLocaleDateString()}
              </p>
            </div>
            <span className="text-xs text-gray-500">
              {org.suspendedAt && <span className="text-red-600">suspended · </span>}
              {org.subscription ? org.subscription.status : "No subscription"}
            </span>
          </div>
        ))}
        {organizations.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-500">No organizations yet.</p>
        )}
      </div>
    </div>
  );
}
