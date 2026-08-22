"use server";

import { revalidatePath } from "next/cache";
import { eq, like } from "drizzle-orm";
import { assetFolders, assets, db, logAudit } from "@superos/db";
import type { AssetType } from "@superos/shared";
import { buildAssetStorageKey, createUploadUrl, deleteObject, getObjectBuffer, putObject } from "@superos/storage";
import { auth } from "@/lib/auth";
import { getFolder } from "./queries";

function mapMimeToAssetType(mimeType: string): AssetType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "text";
}

export async function createFolderAction(input: { parentId: string | null; name: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Folder name is required");

  const parent = input.parentId ? await getFolder(input.parentId) : null;
  const pathCache = parent ? `${parent.pathCache}/${name}` : name;

  await db.insert(assetFolders).values({ parentId: input.parentId, name, pathCache });
  revalidatePath("/assets");
}

export async function renameFolderAction(folderId: string, newName: string) {
  const name = newName.trim();
  if (!name) throw new Error("Folder name is required");

  const folder = await getFolder(folderId);
  if (!folder) throw new Error("Folder not found");

  const oldPrefix = folder.pathCache;
  const newPrefix = folder.parentId ? `${oldPrefix.split("/").slice(0, -1).join("/")}/${name}` : name;

  await db.update(assetFolders).set({ name, pathCache: newPrefix }).where(eq(assetFolders.id, folderId));

  const descendants = await db
    .select()
    .from(assetFolders)
    .where(like(assetFolders.pathCache, `${oldPrefix}/%`));
  for (const descendant of descendants) {
    const rest = descendant.pathCache.slice(oldPrefix.length);
    await db
      .update(assetFolders)
      .set({ pathCache: `${newPrefix}${rest}` })
      .where(eq(assetFolders.id, descendant.id));
  }

  revalidatePath("/assets");
}

export async function moveFolderAction(folderId: string, newParentId: string | null) {
  const folder = await getFolder(folderId);
  if (!folder) throw new Error("Folder not found");
  if (newParentId === folderId) throw new Error("Cannot move a folder into itself");

  const newParent = newParentId ? await getFolder(newParentId) : null;
  if (newParentId && !newParent) throw new Error("Target folder not found");
  if (newParent && (newParent.pathCache === folder.pathCache || newParent.pathCache.startsWith(`${folder.pathCache}/`))) {
    throw new Error("Cannot move a folder into its own subfolder");
  }
  if (folder.parentId === newParentId) return; // already there

  const oldPrefix = folder.pathCache;
  const newPrefix = newParent ? `${newParent.pathCache}/${folder.name}` : folder.name;

  await db.update(assetFolders).set({ parentId: newParentId, pathCache: newPrefix }).where(eq(assetFolders.id, folderId));

  const descendants = await db
    .select()
    .from(assetFolders)
    .where(like(assetFolders.pathCache, `${oldPrefix}/%`));
  for (const descendant of descendants) {
    const rest = descendant.pathCache.slice(oldPrefix.length);
    await db
      .update(assetFolders)
      .set({ pathCache: `${newPrefix}${rest}` })
      .where(eq(assetFolders.id, descendant.id));
  }

  revalidatePath("/assets");
}

export async function deleteFolderAction(folderId: string) {
  const [childFolder] = await db
    .select({ id: assetFolders.id })
    .from(assetFolders)
    .where(eq(assetFolders.parentId, folderId))
    .limit(1);
  const [childAsset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.folderId, folderId))
    .limit(1);

  if (childFolder || childAsset) {
    throw new Error("Folder is not empty — move or delete its contents first");
  }

  await db.delete(assetFolders).where(eq(assetFolders.id, folderId));
  const session = await auth();
  await logAudit({ actorId: session?.user?.id ?? null, action: "delete", entityType: "asset_folder", entityId: folderId });
  revalidatePath("/assets");
}

export async function requestUploadUrlAction(input: { filename: string; contentType: string }) {
  const storageKey = buildAssetStorageKey("assets", input.filename);
  const { url } = await createUploadUrl(storageKey, input.contentType);
  return { uploadUrl: url, storageKey };
}

export async function confirmUploadAction(input: {
  storageKey: string;
  filename: string;
  contentType: string;
  folderId: string | null;
  sizeBytes: number;
}) {
  const session = await auth();

  const [asset] = await db
    .insert(assets)
    .values({
      type: mapMimeToAssetType(input.contentType),
      mimeType: input.contentType,
      title: input.filename,
      folderId: input.folderId,
      storageKey: input.storageKey,
      sourceKind: "upload",
      metadataJson: { sizeBytes: input.sizeBytes },
      createdBy: session?.user?.id ?? null,
    })
    .returning();

  revalidatePath("/assets");
  return asset;
}

export async function moveAssetAction(assetId: string, folderId: string | null) {
  await db.update(assets).set({ folderId }).where(eq(assets.id, assetId));
  revalidatePath("/assets");
}

export async function duplicateAssetAction(assetId: string, folderId?: string | null) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) throw new Error("Asset not found");

  const ext = asset.storageKey.split(".").pop();
  const newKey = buildAssetStorageKey("assets", `${asset.title}-copy${ext ? `.${ext}` : ""}`);
  const buf = await getObjectBuffer(asset.storageKey);
  await putObject(newKey, buf, asset.mimeType ?? "application/octet-stream");

  const session = await auth();
  const [copy] = await db
    .insert(assets)
    .values({
      type: asset.type,
      mimeType: asset.mimeType,
      title: `${asset.title} (copy)`,
      description: asset.description,
      folderId: folderId !== undefined ? folderId : asset.folderId,
      storageKey: newKey,
      sourceKind: asset.sourceKind,
      sourceRunId: asset.sourceRunId,
      metadataJson: asset.metadataJson,
      createdBy: session?.user?.id ?? null,
    })
    .returning();

  revalidatePath("/assets");
  return copy;
}

export async function deleteAssetAction(assetId: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) return;

  await deleteObject(asset.storageKey).catch(() => {
    // Best-effort — don't block deleting the DB record on a storage hiccup.
  });
  if (asset.previewKey) {
    await deleteObject(asset.previewKey).catch(() => {});
  }
  await db.delete(assets).where(eq(assets.id, assetId));
  const session = await auth();
  await logAudit({
    actorId: session?.user?.id ?? null,
    action: "delete",
    entityType: "asset",
    entityId: assetId,
    metadata: { title: asset.title },
  });
  revalidatePath("/assets");
}
