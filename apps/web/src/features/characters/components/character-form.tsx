"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/drop-zone";
import { createCharacterAction, requestUploadUrlAction } from "../actions";

export function CharacterForm() {
  const [name, setName] = useState("");
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
    if (!file || !name.trim()) return;
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

      await createCharacterAction({
        name,
        description,
        storageKey,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      setName("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create character");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-none border border-ink/10 bg-ink/5 p-4">
      <p className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">New character</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Character name"
        required
        className="w-full rounded-none border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none"
      />
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
          accept="image/*"
          required
          className="w-full text-xs text-ink/60"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        {fileName && <p className="mt-1 text-[10px] text-ink/40">Selected: {fileName}</p>}
      </DropZone>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-none bg-[#004c37] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Creating…" : "Create character"}
      </button>
    </form>
  );
}
