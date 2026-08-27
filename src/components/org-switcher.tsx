"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type OrgOption = { id: string; name: string };

export function OrgSwitcher({
  organizations,
  activeOrgId,
}: {
  organizations: OrgOption[];
  activeOrgId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (organizations.length <= 1) {
    return <p className="truncate font-medium">{organizations[0]?.name ?? "—"}</p>;
  }

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const organizationId = e.target.value;
    await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <select
      defaultValue={activeOrgId}
      onChange={handleChange}
      disabled={isPending}
      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:border-gray-900 disabled:opacity-50"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
