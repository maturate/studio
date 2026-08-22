"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReferenceAction } from "../actions";

export interface ReferenceCardData {
  id: string;
  type: string;
  title: string;
  description: string | null;
  mimeType: string | null;
  previewUrl: string | null;
}

export function ReferenceCard({ reference }: { reference: ReferenceCardData }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="group relative overflow-hidden rounded-none border border-ink/10 bg-ink/5">
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-ink/5">
        {reference.mimeType?.startsWith("image/") && reference.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reference.previewUrl} alt={reference.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl">🔗</span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm text-ink/90">{reference.title}</p>
        <p className="text-xs font-mono uppercase tracking-wide text-ink/40">{reference.type}</p>
        {reference.description && <p className="truncate text-xs text-ink/50">{reference.description}</p>}
        <p className="truncate font-mono text-[10px] text-ink/30">id: {reference.id}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete reference "${reference.title}"?`)) return;
          startTransition(async () => {
            await deleteReferenceAction(reference.id);
            router.refresh();
          });
        }}
        className="absolute right-2 top-2 hidden rounded-none bg-black/70 px-2 py-1 text-xs text-white backdrop-blur hover:bg-red-500/80 group-hover:block"
      >
        {pending ? "…" : "Delete"}
      </button>
    </div>
  );
}
