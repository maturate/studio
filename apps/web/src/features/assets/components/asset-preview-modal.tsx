"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MODEL_REGISTRY } from "@superos/model-registry";
import type { DataType } from "@superos/shared";

export interface AssetCardData {
  id: string;
  title: string;
  type: string;
  mimeType: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  createdAt: string | Date;
  sourceKind: string;
  metadataJson: unknown;
  folderId: string | null;
  creatorName: string | null;
}

export const TYPE_ICON: Record<string, string> = {
  image: "🖼️",
  audio: "🎵",
  video: "🎬",
  text: "📄",
  reference: "🔗",
  character: "🧑‍🎤",
  workflow_output: "⚙️",
};

interface GenerationMetadata {
  modelId?: string;
  prompt?: string | null;
  settings?: Record<string, unknown>;
  costUsd?: number | null;
}

/**
 * The single asset preview lightbox — used by the Asset Library grid and by
 * the Playground's output tiles, so "open" behaves identically everywhere:
 * same fullscreen layout, same Edit/Remix/Download actions, same metadata
 * panel (model, prompt, settings, creator, created date).
 */
export function AssetPreviewModal({
  asset,
  onClose,
  onEdit,
  onRemix,
}: {
  asset: AssetCardData;
  onClose: () => void;
  /** When provided (e.g. from the Playground, which already has this asset's
   * inputs live in its own form state), used instead of navigating to
   * `/playground?editAssetId=`/`?remixAssetId=` — a same-page Link navigation
   * doesn't re-run the form's one-time state initialization, so it silently
   * does nothing when the modal is already open inside the Playground. */
  onEdit?: () => void;
  onRemix?: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isGenerated = asset.sourceKind !== "upload";
  const meta = (isGenerated ? (asset.metadataJson as GenerationMetadata | null) : null) ?? {};
  const model = meta.modelId ? MODEL_REGISTRY.find((m) => m.id === meta.modelId) : undefined;
  const settingsEntries = meta.settings ? Object.entries(meta.settings).filter(([, v]) => v !== undefined && v !== "") : [];
  // Edit only makes sense if the model that made this asset also accepts this asset's own type back as input.
  const canEdit = Boolean(model && model.inputTypes.includes(asset.type as DataType));
  const canRemix = Boolean(model);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col gap-3 lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm text-white/80">
            <p className="truncate">{asset.title}</p>
            <div className="flex shrink-0 items-center gap-2">
              {canEdit &&
                (onEdit ? (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
                  >
                    Edit
                  </button>
                ) : (
                  <Link
                    href={`/playground?editAssetId=${asset.id}`}
                    className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
                  >
                    Edit
                  </Link>
                ))}
              {canRemix &&
                (onRemix ? (
                  <button
                    type="button"
                    onClick={onRemix}
                    className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
                  >
                    Remix
                  </button>
                ) : (
                  <Link
                    href={`/playground?remixAssetId=${asset.id}`}
                    className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
                  >
                    Remix
                  </Link>
                ))}
              {asset.downloadUrl && (
                <a
                  href={asset.downloadUrl}
                  download
                  className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
                >
                  Download ↓
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
              >
                Close ✕
              </button>
            </div>
          </div>

          {asset.type === "audio" && asset.previewUrl ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 bg-white p-10">
              <span className="text-5xl">🎵</span>
              <audio src={asset.previewUrl} controls autoPlay className="w-full min-w-[320px]" />
            </div>
          ) : (
          <div className="flex max-h-[80vh] items-center justify-center overflow-hidden bg-black">
            {asset.type === "image" && asset.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URLs
              <img src={asset.previewUrl} alt={asset.title} className="max-h-[80vh] max-w-full object-contain" />
            ) : asset.type === "video" && asset.previewUrl ? (
              <video src={asset.previewUrl} controls autoPlay className="max-h-[80vh] max-w-full" />
            ) : (
              <div className="flex flex-col items-center gap-3 p-16 text-white/60">
                <span className="text-5xl">{TYPE_ICON[asset.type] ?? "📁"}</span>
                <p className="text-sm">No inline preview for this file type.</p>
              </div>
            )}
          </div>
          )}
        </div>

        <div className="w-full shrink-0 space-y-4 overflow-y-auto bg-white p-4 text-xs lg:w-72">
            <div className="space-y-1">
              <p className="font-mono uppercase tracking-wide text-ink/40">{isGenerated ? "Generated by" : "Uploaded by"}</p>
              <p className="text-ink/80">{asset.creatorName ?? "Unknown"}</p>
            </div>
            {meta.prompt && (
              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-ink/40">Prompt</p>
                <p className="whitespace-pre-wrap text-ink/80">{meta.prompt}</p>
              </div>
            )}
            {typeof meta.costUsd === "number" && (
              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-ink/40">Cost</p>
                <p className="text-ink/80">${meta.costUsd.toFixed(3)}</p>
              </div>
            )}
            {model && (
              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-ink/40">Model</p>
                <p className="text-ink/80">{model.label}</p>
              </div>
            )}
            {settingsEntries.length > 0 && (
              <div className="space-y-1">
                <p className="font-mono uppercase tracking-wide text-ink/40">Settings</p>
                <dl className="space-y-1">
                  {settingsEntries.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <dt className="text-ink/45">{key}</dt>
                      <dd className="truncate text-ink/80">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="space-y-1">
              <p className="font-mono uppercase tracking-wide text-ink/40">Created</p>
              <p className="text-ink/80">{new Date(asset.createdAt).toLocaleString()}</p>
            </div>
        </div>
      </div>
    </div>
  );
}
