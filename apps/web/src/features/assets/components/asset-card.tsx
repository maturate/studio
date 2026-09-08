"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteAssetAction, duplicateAssetAction, moveAssetAction } from "../actions";
import { AssetPreviewModal, TYPE_ICON, type AssetCardData } from "./asset-preview-modal";

export type { AssetCardData };

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

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

