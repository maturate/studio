"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/drop-zone";
import { createReferenceAction, requestUploadUrlAction } from "../actions";

const TYPES = ["style", "product", "location", "other"] as const;

export function ReferenceForm() {
  const [type, setType] = useState<(typeof TYPES)[number]>("style");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDroppedFiles(files: FileList) {
    if (fileRef.current) {
      fileRef.current.files = files;
      setFileName(files[0]?.name ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;
    setPending(true);
    setError(null);

    try {
      const { uploadUrl, storageKey } = await requestUploadUrlAction({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      });
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      await createReferenceAction({
        type,
        title,
        description,
        storageKey,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      setTitle("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create reference");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-none border border-ink/10 bg-ink/5 p-4">
      <p className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">New reference</p>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
          className="rounded-none border border-ink/10 bg-white px-3 py-2 text-sm text-ink focus:outline-none"
        >
          {TYPES.map((t) => (
            <option key={t} value={t} className="bg-white">
              {t}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="flex-1 rounded-none border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none"
        />
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-none border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none"
      />
      <DropZone onFiles={handleDroppedFiles} className="block rounded-none border border-dashed border-ink/20 px-3 py-2">
        <input
          ref={fileRef}
          type="file"
          required
          className="w-full text-xs text-ink/60"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        {fileName && <p className="mt-1 text-[10px] text-ink/40">Selected: {fileName}</p>}
      </DropZone>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Creating…" : "Create reference"}
      </button>
    </form>
  );
}
