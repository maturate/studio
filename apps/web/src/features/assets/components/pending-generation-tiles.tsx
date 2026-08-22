"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pollRunStatusAction } from "@/features/playground/actions";
import type { PendingRun } from "../queries";

const POLL_INTERVAL_MS = 1500;

/** Shimmer placeholders for Playground runs still generating into the currently-viewed folder — polls and refreshes the page once any of them finish. */
export function PendingGenerationTiles({ runs }: { runs: PendingRun[] }) {
  const router = useRouter();

  useEffect(() => {
    if (runs.length === 0) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      const statuses = await Promise.all(runs.map((r) => pollRunStatusAction(r.runId)));
      if (cancelled) return;
      const anyTerminal = statuses.some((s) => s.status === "succeeded" || s.status === "failed");
      if (anyTerminal) router.refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [runs, router]);

  return (
    <>
      {runs.flatMap((r) =>
        Array.from({ length: r.count }).map((_, i) => (
          <div key={`${r.runId}-${i}`} className="aspect-square animate-pulse bg-ink/10" />
        )),
      )}
    </>
  );
}
