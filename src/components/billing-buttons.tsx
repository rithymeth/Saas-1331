"use client";

import { useState } from "react";

async function goToCheckout(endpoint: string, setLoading: (v: boolean) => void) {
  setLoading(true);
  try {
    const res = await fetch(endpoint, { method: "POST" });
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

export function SubscribeButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={() => goToCheckout("/api/billing/checkout", setLoading)}
      disabled={loading}
      className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
    >
      {loading ? "Redirecting…" : "Subscribe"}
    </button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={() => goToCheckout("/api/billing/portal", setLoading)}
      disabled={loading}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? "Redirecting…" : "Manage billing"}
    </button>
  );
}
