"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkflowAction, duplicateWorkflowAction } from "../actions";

export function WorkflowRowActions({ workflowId, name }: { workflowId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const { workflowId: newId } = await duplicateWorkflowAction(workflowId);
            router.push(`/workflows/${newId}`);
          });
        }}
        className="rounded-none px-2 py-1 text-xs text-ink/40 hover:bg-ink/10 hover:text-ink/80"
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          if (!confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
          startTransition(async () => {
            await deleteWorkflowAction(workflowId);
            router.refresh();
          });
        }}
        className="rounded-none px-2 py-1 text-xs text-ink/30 hover:bg-red-500/10 hover:text-red-700"
      >
        Delete
      </button>
    </div>
  );
}
