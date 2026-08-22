"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
    >
      Sign out
    </button>
  );
}
