import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 flex-col justify-between border-r border-gray-200 px-4 py-6">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Organization
            </p>
            <p className="font-medium">{membership?.organization.name ?? "—"}</p>
          </div>

          <nav className="flex flex-col gap-1 text-sm">
            <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-gray-100">
              Dashboard
            </Link>
            <Link href="/dashboard/team" className="rounded-md px-3 py-2 hover:bg-gray-100">
              Team
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex flex-col gap-2">
          <p className="truncate text-sm text-gray-600">{session.user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
