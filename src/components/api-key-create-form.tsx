"use client";

import { useActionState } from "react";

type State = { key?: string; error?: string };

export function ApiKeyCreateForm({
  action,
}: {
  action: (prevState: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, isPending] = useActionState<State, FormData>(action, {});

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="e.g. CI pipeline"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create key"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.key && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
          <p className="text-xs font-medium text-amber-800">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <code className="break-all text-xs text-amber-900">{state.key}</code>
        </div>
      )}
    </div>
  );
}
