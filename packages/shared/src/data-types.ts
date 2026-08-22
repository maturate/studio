/**
 * Canonical node port / value data types shared by the model registry,
 * workflow engine, and playground. Keep this list in sync with
 * AGENTS.md section 9.4 — do not fork a parallel type list per feature.
 */
export const DATA_TYPES = [
  "text",
  "image",
  "images",
  "audio",
  "video",
  "frames",
  "reference",
  "character",
  "context",
  "json",
  "any",
] as const;

export type DataType = (typeof DATA_TYPES)[number];

export const ASSET_TYPES = [
  "image",
  "audio",
  "video",
  "text",
  "reference",
  "character",
  "workflow_output",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_SOURCE_KINDS = [
  "upload",
  "playground",
  "workflow",
  "reference",
  "character",
  "stt",
  "script",
] as const;

export type AssetSourceKind = (typeof ASSET_SOURCE_KINDS)[number];

export const RUN_SCOPES = [
  "playground",
  "workflow_node",
  "workflow_branch",
  "workflow_full",
  "bulk",
  "stt",
] as const;

export type RunScope = (typeof RUN_SCOPES)[number];

export const RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const CONTEXT_MODES = [
  "none",
  "suggested",
  "pinned_pack",
  "agentic",
] as const;

export type ContextMode = (typeof CONTEXT_MODES)[number];

export const USER_ROLES = ["admin", "operator"] as const;
export type UserRole = (typeof USER_ROLES)[number];
