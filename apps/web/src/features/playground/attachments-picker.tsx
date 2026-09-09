"use client";

import { useEffect, useRef, useState } from "react";
import { listAttachableItemsAction, resolveAttachmentsAction, type AttachableItem } from "./attachments";
import { confirmUploadAction, requestUploadUrlAction } from "@/features/assets/actions";
import { DropZone } from "@/components/drop-zone";

export interface Attachment {
  assetId: string;
  url: string;
  mimeType: string;
  type: string;
  title: string;
  /** Where it came from — library items get tagged by their own name in
   * prompts, uploads/assets get tagged by type and index (@image-1). */
  source?: "asset" | "reference" | "character";
}

/**
 * Uploads files and resolves them to attachments. Exported so the prompt box
 * can reuse it for clipboard paste, rather than duplicating the upload dance.
 */
export async function uploadFilesAsAttachments(files: File[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const file of files) {
    const { uploadUrl, storageKey } = await requestUploadUrlAction({
      filename: file.name || `pasted-${Date.now()}`,
      contentType: file.type || "application/octet-stream",
    });
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putRes.ok) throw new Error(`Upload failed for ${file.name || "pasted file"} (${putRes.status})`);

    const asset = await confirmUploadAction({
      storageKey,
      filename: file.name || `pasted-${Date.now()}`,
      contentType: file.type || "application/octet-stream",
      folderId: null,
      sizeBytes: file.size,
    });
    if (!asset) continue;
    const [resolved] = await resolveAttachmentsAction([asset.id]);
    // confirmUploadAction already maps the mime type to an asset type, so an
    // uploaded/pasted image comes back as type "image" without extra work.
    if (resolved) out.push({ ...resolved, source: "asset" });
  }
  return out;
}

type PickerKind = "asset" | "reference" | "character";

const KIND_LABEL: Record<PickerKind, string> = {
  asset: "Assets",
  reference: "References",
  character: "Characters",
};

/** The three raw file modalities, each surfaced as its own pair of buttons so it's
 * immediately visible which ones the selected model actually accepts. */
const MODALITIES = [
  { modality: "image", label: "Image", icon: "🖼️", dataTypes: new Set(["image", "images", "frames"]), accept: "image/*" },
  { modality: "video", label: "Video", icon: "🎬", dataTypes: new Set(["video"]), accept: "video/*" },
  { modality: "audio", label: "Audio", icon: "🎵", dataTypes: new Set(["audio"]), accept: "audio/*" },
] as const;

/**
 * Lets the user attach existing assets/references/characters (or upload a
 * new file) as generation input — shown only for models whose `inputTypes`
 * accept something beyond plain text.
 */
export function AttachmentsPicker({
  dataTypes,
  attachments,
  onChange,
}: {
  dataTypes: string[];
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
}) {
  const [openPicker, setOpenPicker] = useState<{ kind: PickerKind; dataTypes: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeModalities = MODALITIES.filter((m) => dataTypes.some((t) => m.dataTypes.has(t)));
  const hasReference = dataTypes.includes("reference");
  const hasCharacter = dataTypes.includes("character");

  function remove(assetId: string) {
    onChange(attachments.filter((a) => a.assetId !== assetId));
  }

  function add(item: Attachment) {
    if (attachments.some((a) => a.assetId === item.assetId)) return;
    onChange([...attachments, item]);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const uploaded of await uploadFilesAsAttachments(Array.from(files))) {
        add(uploaded);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Attachments</label>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <div key={a.assetId} className="group relative h-16 w-16 shrink-0 overflow-hidden border border-ink/15 bg-ink/5">
            {a.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL
              <img src={a.url} alt={a.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl">
                {a.type === "video" ? "🎬" : a.type === "audio" ? "🎵" : "📁"}
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(a.assetId)}
              className="absolute inset-0 hidden items-center justify-center bg-black/60 text-xs text-white group-hover:flex"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {activeModalities.map(({ modality, label, icon, accept }) => (
        <div key={modality} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink/40">{icon} {label}:</span>
          <DropZone onFiles={handleUpload} disabled={uploading} className="inline-block">
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.accept = accept;
                fileInputRef.current?.click();
              }}
              className="rounded-none border border-dashed border-ink/25 px-2.5 py-1.5 text-xs text-ink/60 hover:border-ink/40 hover:text-ink/90 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "+ Upload (or drop)"}
            </button>
          </DropZone>
          <button
            type="button"
            onClick={() => setOpenPicker({ kind: "asset", dataTypes: [modality] })}
            className="rounded-none border border-dashed border-ink/25 px-2.5 py-1.5 text-xs text-ink/60 hover:border-ink/40 hover:text-ink/90"
          >
            + Browse {label.toLowerCase()} assets
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {hasReference && (
          <button
            type="button"
            onClick={() => setOpenPicker({ kind: "reference", dataTypes })}
            className="rounded-none border border-dashed border-ink/25 px-2.5 py-1.5 text-xs text-ink/60 hover:border-ink/40 hover:text-ink/90"
          >
            + References
          </button>
        )}
        {hasCharacter && (
          <button
            type="button"
            onClick={() => setOpenPicker({ kind: "character", dataTypes })}
            className="rounded-none border border-dashed border-ink/25 px-2.5 py-1.5 text-xs text-ink/60 hover:border-ink/40 hover:text-ink/90"
          >
            + Characters
          </button>
        )}
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleUpload(e.target.files)} />

      {openPicker && (
        <AttachmentPickerModal
          kind={openPicker.kind}
          dataTypes={openPicker.dataTypes}
          onPick={(item) =>
            add({
              assetId: item.assetId,
              url: item.previewUrl!,
              mimeType: item.mimeType ?? "",
              type: item.type,
              title: item.title,
              source: openPicker.kind,
            })
          }
          onClose={() => setOpenPicker(null)}
        />
      )}
    </div>
  );
}

function AttachmentPickerModal({
  kind,
  dataTypes,
  onPick,
  onClose,
}: {
  kind: PickerKind;
  dataTypes: string[];
  onPick: (item: AttachableItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<AttachableItem[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    listAttachableItemsAction(dataTypes, kind, query || undefined).then((res) => {
      if (!cancelled) setItems(res);
    });
    return () => {
      cancelled = true;
    };
  }, [dataTypes, kind, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-3 bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">{KIND_LABEL[kind]}</p>
          <button type="button" onClick={onClose} className="shrink-0 text-sm text-ink/50 hover:text-ink/90">
            Close ✕
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-none border border-ink/15 bg-ink/5 px-3 py-1.5 text-sm text-ink placeholder:text-ink/35 focus:border-ink/25 focus:outline-none"
        />

        <div className="grid grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {items === null ? (
            <p className="col-span-full py-8 text-center text-sm text-ink/40">Loading…</p>
          ) : items.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-ink/40">Nothing found.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.assetId}
                type="button"
                disabled={!item.previewUrl}
                onClick={() => {
                  onPick(item);
                  onClose();
                }}
                className="group relative aspect-square overflow-hidden border border-ink/10 bg-ink/5 text-left disabled:opacity-40"
                title={item.title}
              >
                {item.type === "image" && item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL
                  <img src={item.previewUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">
                    {item.type === "video" ? "🎬" : item.type === "audio" ? "🎵" : "📁"}
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-[9px] text-white">
                  {item.title}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
