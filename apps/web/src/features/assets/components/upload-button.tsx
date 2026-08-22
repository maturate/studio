"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/drop-zone";
import { confirmUploadAction, requestUploadUrlAction } from "../actions";

export function UploadButton({ folderId }: { folderId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const { uploadUrl, storageKey } = await requestUploadUrlAction({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        });

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed for ${file.name} (${putRes.status})`);
        }

        await confirmUploadAction({
          storageKey,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          folderId,
          sizeBytes: file.size,
        });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <DropZone onFiles={handleFiles} className="flex items-center gap-2">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#00614a] disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload (or drop files)"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </DropZone>
  );
}
