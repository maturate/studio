"use client";

import { useEffect, useState } from "react";
import { pollWorkflowRunAction } from "../actions";

const TERMINAL = new Set(["succeeded", "failed"]);

interface StepView {
  id: string;
  nodeId: string | null;
  status: string;
  logsJson: unknown;
}

export function RunPanel({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [status, setStatus] = useState<string>("queued");
  const [steps, setSteps] = useState<StepView[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const result = await pollWorkflowRunAction(runId);
      if (!result || cancelled) return;
      setStatus(result.run.status);
      setSteps(
        result.steps.map((s) => ({ id: s.id, nodeId: s.nodeId, status: s.status, logsJson: s.logsJson })),
      );
      if (!TERMINAL.has(result.run.status)) {
        setTimeout(tick, 1500);
      }
    }
    tick();

    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <div className="absolute bottom-4 right-4 z-30 w-80 rounded-none border border-ink/10 bg-ink/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium font-mono uppercase tracking-wide text-ink/50">
          Run — <span className="text-ink/80">{status}</span>
        </p>
        <button type="button" onClick={onClose} className="text-ink/40 hover:text-ink/80">
          ✕
        </button>
      </div>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {steps.length === 0 && <p className="text-xs text-ink/40">Waiting for steps…</p>}
        {steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between rounded-none bg-ink/5 px-2.5 py-1.5 text-xs">
            <span className="truncate text-ink/70">{step.nodeId?.slice(0, 8) ?? "playground"}</span>
            <span
              className={
                step.status === "succeeded"
                  ? "text-emerald-400"
                  : step.status === "failed"
                    ? "text-red-600"
                    : "text-ink/50"
              }
            >
              {step.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
