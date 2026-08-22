import type { AssetType } from "@superos/shared";

const TYPE_OPTIONS: { value: AssetType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "text", label: "Text / other" },
  { value: "reference", label: "Reference" },
  { value: "character", label: "Character" },
  { value: "workflow_output", label: "Workflow output" },
];

export function AssetToolbar({
  folderId,
  query,
  type,
}: {
  folderId: string | null;
  query: string;
  type: string;
}) {
  return (
    <form action="/assets" className="flex flex-wrap items-center gap-3">
      {folderId && <input type="hidden" name="folder" value={folderId} />}
      <input
        type="text"
        name="q"
        defaultValue={query}
        placeholder="Search assets by title…"
        className="w-64 rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/25 focus:outline-none"
      />
      <select
        name="type"
        defaultValue={type}
        className="rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink focus:border-ink/25 focus:outline-none"
      >
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white">
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-none border border-ink/10 bg-ink/8 px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/15"
      >
        Filter
      </button>
    </form>
  );
}
