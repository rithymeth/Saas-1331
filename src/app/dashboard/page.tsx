import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">
        Welcome{session?.user?.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="text-gray-600">
        This is your dashboard. Nothing here yet — start building.
      </p>
    </div>
  );
}
