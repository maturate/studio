"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContextPackAction } from "./actions";

export function DeletePackButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete context pack "${name}"?`)) return;
        startTransition(async () => {
          await deleteContextPackAction(id);
          router.refresh();
        });
      }}
      className="rounded-none px-2 py-1 text-xs text-ink/30 hover:bg-red-500/10 hover:text-red-700"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
