"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkflowAction } from "../actions";

export function NewWorkflowButton() {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#00614a]"
      >
        New workflow
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const { workflowId } = await createWorkflowAction(name);
          router.push(`/workflows/${workflowId}`);
        });
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Workflow name"
        className="w-48 rounded-none border border-ink/15 bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
      />
      <button type="submit" disabled={pending} className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
