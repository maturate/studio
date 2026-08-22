import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dims = (config as { dimensions?: number } | undefined)?.dimensions ?? 1536;
    return `vector(${dims})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value
      .slice(1, -1)
      .split(",")
      .filter(Boolean)
      .map(Number);
  },
});

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// 8.1 Auth and access
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: id(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  googleSubjectId: varchar("google_subject_id", { length: 255 }).unique(),
  role: varchar("role", { length: 32 }).notNull().default("operator"),
  isAuthorized: boolean("is_authorized").notNull().default(false),
  ...timestamps,
});

/** AGENTS.md §12.3: "audit logging for deletes and important workflow changes". */
export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id"),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const allowedEmails = pgTable("allowed_emails", {
  id: id(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 8.2 Assets
// ---------------------------------------------------------------------------

export const assetFolders = pgTable("asset_folders", {
  id: id(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  pathCache: text("path_cache").notNull(),
  ...timestamps,
});

export const assets = pgTable("assets", {
  id: id(),
  type: varchar("type", { length: 32 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }),
  title: text("title").notNull(),
  description: text("description"),
  folderId: uuid("folder_id").references(() => assetFolders.id, { onDelete: "set null" }),
  storageKey: text("storage_key").notNull(),
  previewKey: text("preview_key"),
  sourceKind: varchar("source_kind", { length: 32 }).notNull(),
  sourceRunId: uuid("source_run_id"),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const assetTags = pgTable("asset_tags", {
  id: id(),
  name: varchar("name", { length: 128 }).notNull().unique(),
});

export const assetTagLinks = pgTable("asset_tag_links", {
  id: id(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => assetTags.id, { onDelete: "cascade" }),
});

// ---------------------------------------------------------------------------
// 8.3 References and characters
// ---------------------------------------------------------------------------

export const references = pgTable("references", {
  id: id(),
  type: varchar("type", { length: 32 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const characters = pgTable("characters", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  referenceAssetId: uuid("reference_asset_id").references(() => assets.id, { onDelete: "set null" }),
  metadataJson: jsonb("metadata_json").notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// 8.4 Workflows
// ---------------------------------------------------------------------------

export const workflows = pgTable("workflows", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  latestVersionId: uuid("latest_version_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const workflowVersions = pgTable("workflow_versions", {
  id: id(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  canvasStateJson: jsonb("canvas_state_json").notNull().default({}),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowPages = pgTable("workflow_pages", {
  id: id(),
  workflowVersionId: uuid("workflow_version_id")
    .notNull()
    .references(() => workflowVersions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
});

export const workflowNodes = pgTable("workflow_nodes", {
  id: id(),
  workflowVersionId: uuid("workflow_version_id")
    .notNull()
    .references(() => workflowVersions.id, { onDelete: "cascade" }),
  pageId: uuid("page_id")
    .notNull()
    .references(() => workflowPages.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 64 }).notNull(),
  title: text("title"),
  positionX: doublePrecision("position_x").notNull().default(0),
  positionY: doublePrecision("position_y").notNull().default(0),
  width: doublePrecision("width"),
  height: doublePrecision("height"),
  dataJson: jsonb("data_json").notNull().default({}),
  ...timestamps,
});

export const workflowEdges = pgTable("workflow_edges", {
  id: id(),
  workflowVersionId: uuid("workflow_version_id")
    .notNull()
    .references(() => workflowVersions.id, { onDelete: "cascade" }),
  sourceNodeId: uuid("source_node_id")
    .notNull()
    .references(() => workflowNodes.id, { onDelete: "cascade" }),
  sourcePort: varchar("source_port", { length: 64 }).notNull(),
  targetNodeId: uuid("target_node_id")
    .notNull()
    .references(() => workflowNodes.id, { onDelete: "cascade" }),
  targetPort: varchar("target_port", { length: 64 }).notNull(),
  dataType: varchar("data_type", { length: 32 }).notNull(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => workflowPages.id, { onDelete: "cascade" }),
});

// ---------------------------------------------------------------------------
// 8.5 Runs
// ---------------------------------------------------------------------------

export const runs = pgTable("runs", {
  id: id(),
  runScope: varchar("run_scope", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  workflowId: uuid("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
  workflowVersionId: uuid("workflow_version_id").references(() => workflowVersions.id, {
    onDelete: "set null",
  }),
  /** The clicked node for `workflow_node` / `workflow_branch` scopes. Null for `workflow_full`/`playground`/`bulk`. */
  targetNodeId: uuid("target_node_id"),
  initiatedBy: uuid("initiated_by").references(() => users.id, { onDelete: "set null" }),
  estimatedCost: doublePrecision("estimated_cost"),
  actualCost: doublePrecision("actual_cost"),
  outputFolderId: uuid("output_folder_id").references(() => assetFolders.id, {
    onDelete: "set null",
  }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runSteps = pgTable("run_steps", {
  id: id(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  nodeId: uuid("node_id").references(() => workflowNodes.id, { onDelete: "set null" }),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  inputSnapshotJson: jsonb("input_snapshot_json").notNull().default({}),
  settingsSnapshotJson: jsonb("settings_snapshot_json").notNull().default({}),
  outputSnapshotJson: jsonb("output_snapshot_json").notNull().default({}),
  logsJson: jsonb("logs_json").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// 8.6 superOS context
// ---------------------------------------------------------------------------

export const knowledgeSources = pgTable("knowledge_sources", {
  id: id(),
  sourceType: varchar("source_type", { length: 32 }).notNull(),
  sourceRef: text("source_ref").notNull(),
  sourceHash: varchar("source_hash", { length: 64 }),
  title: text("title").notNull(),
  active: boolean("active").notNull().default(true),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: id(),
  knowledgeSourceId: uuid("knowledge_source_id")
    .notNull()
    .references(() => knowledgeSources.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  // Matches Gemini's `gemini-embedding-001` at outputDimensionality: 768 —
  // keep this in sync with GEMINI_EMBEDDING_DIMENSIONS in
  // packages/context-engine/src/embed.ts if the embedding model changes.
  embedding: vector("embedding", { dimensions: 768 }),
  metadataJson: jsonb("metadata_json").notNull().default({}),
});

export const contextPacks = pgTable("context_packs", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  selectionRulesJson: jsonb("selection_rules_json").notNull().default({}),
  pinnedSourcesJson: jsonb("pinned_sources_json").notNull().default([]),
  ...timestamps,
});

export const runContextLinks = pgTable("run_context_links", {
  id: id(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  nodeId: uuid("node_id").references(() => workflowNodes.id, { onDelete: "set null" }),
  contextPackId: uuid("context_pack_id").references(() => contextPacks.id, {
    onDelete: "set null",
  }),
  resolvedSourcesJson: jsonb("resolved_sources_json").notNull().default([]),
});
