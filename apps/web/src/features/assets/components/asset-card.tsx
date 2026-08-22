"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MODEL_REGISTRY } from "@superos/model-registry";
import type { DataType } from "@superos/shared";
import { deleteAssetAction, duplicateAssetAction, moveAssetAction } from "../actions";

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

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

const TYPE_ICON: Record<string, string> = {
  image: "🖼️",
  audio: "🎵",
  video: "🎬",
  text: "📄",
  reference: "🔗",
  character: "🧑‍🎤",
  workflow_output: "⚙️",
};

function VideoThumbnail({ src, className }: { src: string; className?: string }) {
  return <video src={src} muted playsInline preload="metadata" className={className} />;
}

export function AssetCard({ asset, folders }: { asset: AssetCardData; folders: FolderOption[] }) {
  const [pending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function handleMove(folderId: string) {
    setMenuOpen(false);
    startTransition(async () => {
      await moveAssetAction(asset.id, folderId || null);
      router.refresh();
    });
  }

  function handleDuplicate() {
    setMenuOpen(false);
    startTransition(async () => {
      await duplicateAssetAction(asset.id);
      router.refresh();
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteAssetAction(asset.id);
      router.refresh();
    });
  }

  return (
    <>
      <div className="group relative overflow-hidden rounded-none border border-ink/10 bg-ink/5">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex aspect-square w-full items-center justify-center overflow-hidden bg-ink/5"
        >
          {asset.type === "image" && asset.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URLs, not next/image-friendly remote patterns
            <img src={asset.previewUrl} alt={asset.title} className="h-full w-full object-cover" />
          ) : asset.type === "video" && asset.previewUrl ? (
            <VideoThumbnail src={asset.previewUrl} className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl">{TYPE_ICON[asset.type] ?? "📁"}</span>
          )}
        </button>

        <div className="space-y-1 p-3">
          <p className="truncate text-sm text-ink/90" title={asset.title}>
            {pending ? "…" : asset.title}
          </p>
          <p className="text-xs text-ink/40">{asset.mimeType ?? asset.type}</p>
        </div>

        <div ref={menuRef} className="absolute right-2 top-2 hidden group-hover:block">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-none bg-black/70 px-2 py-1 text-xs text-white backdrop-blur transition hover:bg-black/85"
            title="Asset options"
          >
            ⋮
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-none border border-ink/10 bg-white text-ink shadow-lg">
              {asset.downloadUrl && (
                <a
                  href={asset.downloadUrl}
                  download
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
                >
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={handleDuplicate}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                Duplicate
              </button>
              <div className="border-t border-ink/10 px-3 py-2">
                <label className="mb-1 block text-[10px] font-mono uppercase tracking-wide text-ink/40">Move to</label>
                <select
                  defaultValue={asset.folderId ?? ""}
                  onChange={(e) => handleMove(e.target.value)}
                  className="w-full rounded-none border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
                >
                  <option value="">Asset Library (root)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {"—".repeat(f.depth)} {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                className="block w-full border-t border-ink/10 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {previewOpen && <AssetPreviewModal asset={asset} onClose={() => setPreviewOpen(false)} />}
    </>
  );
}

interface GenerationMetadata {
  modelId?: string;
  prompt?: string | null;
  settings?: Record<string, unknown>;
  costUsd?: number | null;
}

function AssetPreviewModal({ asset, onClose }: { asset: AssetCardData; onClose: () => void }) {
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
              {canEdit && (
                <Link
                  href={`/playground?editAssetId=${asset.id}`}
                  className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
                >
                  Edit
                </Link>
              )}
              {canRemix && (
                <Link
                  href={`/playground?remixAssetId=${asset.id}`}
                  className="rounded-none border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/20"
                >
                  Remix
                </Link>
              )}
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
