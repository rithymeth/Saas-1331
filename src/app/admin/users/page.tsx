import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: { memberships: { include: { organization: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-sm text-gray-500">{users.length} total</p>

      <div className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-200">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{user.name ?? user.email}</p>
              <p className="text-xs text-gray-500">
                {user.email} · joined {user.createdAt.toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {user.memberships.map((m) => (
                <span
                  key={m.id}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {m.organization.name} ({m.role.toLowerCase()})
                </span>
              ))}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-500">No users yet.</p>
        )}
      </div>
    </div>
  );
}
