import { and, asc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { assetFolders, assets, db, runs, runSteps, users } from "@superos/db";
import type { AssetType } from "@superos/shared";
import { createDownloadUrl } from "@superos/storage";

export interface AssetPreview {
  id: string;
  type: AssetType;
  mimeType: string | null;
  previewUrl: string | null;
}

/** Fetches preview URLs for a set of asset ids, preserving the order of `ids`. */
export async function getAssetPreviews(ids: string[]): Promise<AssetPreview[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(assets).where(inArray(assets.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const previews = await Promise.all(
    ids.map(async (id) => {
      const row = byId.get(id);
      if (!row) return null;
      return {
        id: row.id,
        type: row.type as AssetType,
        mimeType: row.mimeType,
        previewUrl: await createDownloadUrl(row.previewKey ?? row.storageKey).catch(() => null),
      };
    }),
  );
  return previews.filter((p): p is AssetPreview => p !== null);
}

export interface FolderBreadcrumbItem {
  id: string;
  name: string;
}

export async function getFolder(folderId: string) {
  const [folder] = await db.select().from(assetFolders).where(eq(assetFolders.id, folderId)).limit(1);
  return folder ?? null;
}

export async function getFolderBreadcrumb(folderId: string | null): Promise<FolderBreadcrumbItem[]> {
  const trail: FolderBreadcrumbItem[] = [];
  let currentId = folderId;

  // Folder depth is expected to stay shallow for an internal asset library —
  // walking parent pointers one at a time is simpler than a recursive CTE.
  while (currentId) {
    const folder = await getFolder(currentId);
    if (!folder) break;
    trail.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return trail;
}

export async function listChildFolders(parentId: string | null) {
  return db
    .select()
    .from(assetFolders)
    .where(parentId ? eq(assetFolders.parentId, parentId) : isNull(assetFolders.parentId))
    .orderBy(asc(assetFolders.name));
}

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

/** Every folder, flattened, ordered so children follow their parent — for folder-picker dropdowns that need the full tree, not just one level. */
export async function listAllFoldersFlat(): Promise<FolderOption[]> {
  const all = await db.select().from(assetFolders).orderBy(asc(assetFolders.pathCache));
  return all.map((f) => ({ id: f.id, name: f.name, depth: f.pathCache.split("/").length - 1 }));
}

export interface PendingRun {
  runId: string;
  count: number;
}

/** Playground runs still queued/running with output headed for this folder — drives shimmer placeholders in the Asset Library while generation is in flight. */
export async function getPendingRunsForFolder(folderId: string | null): Promise<PendingRun[]> {
  const activeRuns = await db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(
        eq(runs.runScope, "playground"),
        folderId ? eq(runs.outputFolderId, folderId) : isNull(runs.outputFolderId),
        inArray(runs.status, ["queued", "running"]),
      ),
    );
  if (activeRuns.length === 0) return [];

  const steps = await db
    .select({ runId: runSteps.runId, settingsSnapshotJson: runSteps.settingsSnapshotJson })
    .from(runSteps)
    .where(inArray(runSteps.runId, activeRuns.map((r) => r.id)));

  return steps.map((step) => {
    const settings = step.settingsSnapshotJson as { count?: number } | null;
    return { runId: step.runId, count: Math.max(1, Number(settings?.count) || 1) };
  });
}

export interface ListAssetsFilter {
  folderId: string | null;
  type?: AssetType;
  query?: string;
}

export async function listAssets(filter: ListAssetsFilter) {
  const conditions = [
    filter.folderId ? eq(assets.folderId, filter.folderId) : isNull(assets.folderId),
  ];
  if (filter.type) {
    conditions.push(eq(assets.type, filter.type));
  }
  if (filter.query) {
    conditions.push(ilike(assets.title, `%${filter.query}%`));
  }

  const rows = await db
    .select({ asset: assets, creatorName: users.name, creatorEmail: users.email })
    .from(assets)
    .leftJoin(users, eq(users.id, assets.createdBy))
    .where(and(...conditions))
    .orderBy(asc(assets.title));

  const withPreviews = await Promise.all(
    rows.map(async ({ asset: row, creatorName, creatorEmail }) => ({
      ...row,
      creatorName: creatorName ?? creatorEmail ?? null,
      previewUrl: await createDownloadUrl(row.previewKey ?? row.storageKey).catch(() => null),
      downloadUrl: await createDownloadUrl(row.storageKey, downloadFilenameFor(row)).catch(() => null),
    })),
  );

  return withPreviews;
}

export async function getAsset(assetId: string) {
  const [row] = await db
    .select({ asset: assets, creatorName: users.name, creatorEmail: users.email })
    .from(assets)
    .leftJoin(users, eq(users.id, assets.createdBy))
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!row) return null;
  return {
    ...row.asset,
    creatorName: row.creatorName ?? row.creatorEmail ?? null,
    previewUrl: await createDownloadUrl(row.asset.previewKey ?? row.asset.storageKey).catch(() => null),
    downloadUrl: await createDownloadUrl(row.asset.storageKey, downloadFilenameFor(row.asset)).catch(() => null),
  };
}

function downloadFilenameFor(row: { title: string; storageKey: string }): string {
  const ext = row.storageKey.split(".").pop();
  return ext ? `${row.title}.${ext}` : row.title;
}
