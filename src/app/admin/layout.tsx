import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user.email)) redirect("/dashboard");

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 flex-col justify-between border-r border-gray-200 px-4 py-6">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Platform</p>
            <p className="font-medium">Admin</p>
          </div>

          <nav className="flex flex-col gap-1 text-sm">
            <Link href="/admin" className="rounded-md px-3 py-2 hover:bg-gray-100">
              Organizations
            </Link>
            <Link href="/admin/users" className="rounded-md px-3 py-2 hover:bg-gray-100">
              Users
            </Link>
            <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-gray-100">
              Back to dashboard
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
