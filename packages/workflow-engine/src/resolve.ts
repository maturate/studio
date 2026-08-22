import type { ReferenceInput } from "./generation/types";

export type ResolvedValue =
  | { kind: "text"; value: string }
  | { kind: "json"; value: unknown }
  | { kind: "asset"; assetId: string; url: string; mimeType: string; assetType: string }
  | { kind: "reference"; referenceId: string; url: string | null; mimeType: string | null }
  | { kind: "character"; characterId: string; url: string | null; mimeType: string | null }
  | { kind: "context"; chunks: { sourceRef: string; sourceTitle: string; content: string }[] }
  | { kind: "empty" };

export function resolvedValueToText(value: ResolvedValue | undefined): string | undefined {
  if (!value) return undefined;
  if (value.kind === "text") return value.value;
  if (value.kind === "json") return typeof value.value === "string" ? value.value : JSON.stringify(value.value);
  return undefined;
}

export function resolvedValueToReference(value: ResolvedValue | undefined): ReferenceInput | undefined {
  if (!value) return undefined;
  if (value.kind === "asset") return { url: value.url, mimeType: value.mimeType };
  if ((value.kind === "reference" || value.kind === "character") && value.url && value.mimeType) {
    return { url: value.url, mimeType: value.mimeType };
  }
  return undefined;
}

export function resolvedValueToContextText(value: ResolvedValue | undefined): string | undefined {
  if (!value || value.kind !== "context" || value.chunks.length === 0) return undefined;
  return value.chunks.map((c) => `[${c.sourceTitle}]\n${c.content}`).join("\n\n---\n\n");
}
