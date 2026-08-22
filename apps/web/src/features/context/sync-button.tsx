"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncSuperOSDocsAction } from "./actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setResult(null);
          startTransition(async () => {
            try {
              const r = await syncSuperOSDocsAction();
              setResult(`Synced ${r.total} docs (${r.ingested} updated, ${r.skipped} unchanged, ${r.chunks} new chunks).`);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sync failed");
            }
          });
        }}
        className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#00614a] disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync superOS docs"}
      </button>
      {result && <p className="text-xs text-emerald-400">{result}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
