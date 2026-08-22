"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFolderAction } from "../actions";

export function NewFolderButton({ parentId }: { parentId: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-none border border-ink/10 bg-ink/8 px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/15"
      >
        New folder
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        startTransition(async () => {
          await createFolderAction({ parentId, name });
          setName("");
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name"
        className="w-40 rounded-none border border-ink/15 bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-ink/50 hover:text-ink/80"
      >
        Cancel
      </button>
    </form>
  );
}
