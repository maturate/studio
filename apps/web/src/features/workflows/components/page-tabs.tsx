"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPageAction, deletePageAction } from "../actions";

export function PageTabs({
  workflowId,
  workflowVersionId,
  pages,
  activePageId,
}: {
  workflowId: string;
  workflowVersionId: string;
  pages: { id: string; name: string }[];
  activePageId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 border-b border-ink/10 bg-white px-4 py-1.5">
      {pages.map((p) => (
        <Link
          key={p.id}
          href={`/workflows/${workflowId}?page=${p.id}`}
          className={`rounded-none px-2.5 py-1 text-xs transition ${
            p.id === activePageId ? "bg-ink/10 text-ink" : "text-ink/50 hover:text-ink/80"
          }`}
        >
          {p.name}
        </Link>
      ))}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const page = await createPageAction(workflowVersionId, `Page ${pages.length + 1}`, pages.length);
            router.push(`/workflows/${workflowId}?page=${page.id}`);
          })
        }
        className="ml-1 rounded-none px-2 py-1 text-xs text-ink/40 hover:bg-ink/10 hover:text-ink/80"
      >
        + Page
      </button>
      {pages.length > 1 && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deletePageAction(activePageId);
              const remaining = pages.find((p) => p.id !== activePageId);
              router.push(`/workflows/${workflowId}${remaining ? `?page=${remaining.id}` : ""}`);
            })
          }
          className="rounded-none px-2 py-1 text-xs text-ink/30 hover:bg-red-500/10 hover:text-red-700"
        >
          Delete page
        </button>
      )}
    </div>
  );
}
