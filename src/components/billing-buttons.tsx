"use client";

import { useState } from "react";

async function goToCheckout(
  endpoint: string,
  body: Record<string, string> | undefined,
  setLoading: (v: boolean) => void
) {
  setLoading(true);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
      alert(data.error ?? "Something went wrong");
    }
  } catch {
    setLoading(false);
    alert("Something went wrong");
  }
}

export function SubscribeButton({ planId, label }: { planId: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={() => goToCheckout("/api/billing/checkout", { planId }, setLoading)}
      disabled={loading}
      className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
    >
      {loading ? "Redirecting…" : (label ?? "Subscribe")}
    </button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={() => goToCheckout("/api/billing/portal", undefined, setLoading)}
      disabled={loading}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? "Redirecting…" : "Manage billing"}
    </button>
  );
}
