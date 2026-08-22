"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContextPackAction } from "./actions";

export function ContextPackForm({ sourceRefs }: { sourceRefs: { ref: string; title: string }[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-3 rounded-none border border-ink/10 bg-ink/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || selected.size === 0) return;
        startTransition(async () => {
          await createContextPackAction({ name, description, pinnedSourceRefs: [...selected] });
          setName("");
          setDescription("");
          setSelected(new Set());
          router.refresh();
        });
      }}
    >
      <p className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">New context pack</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pack name"
        className="w-full rounded-none border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="w-full rounded-none border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none"
      />
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-none border border-ink/10 bg-white p-2">
        {sourceRefs.length === 0 && <p className="p-2 text-xs text-ink/35">No ingested sources yet — sync docs first.</p>}
        {sourceRefs.map((s) => (
          <label key={s.ref} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-ink/70 hover:bg-ink/5">
            <input
              type="checkbox"
              checked={selected.has(s.ref)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(s.ref);
                else next.delete(s.ref);
                setSelected(next);
              }}
            />
            {s.title}
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending || !name.trim() || selected.size === 0}
        className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create pack"}
      </button>
    </form>
  );
}
