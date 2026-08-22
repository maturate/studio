"use server";

import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { assets, characters, db, references } from "@superos/db";
import type { AssetType } from "@superos/shared";
import { createDownloadUrl } from "@superos/storage";
import { auth } from "@/lib/auth";

export interface AttachableItem {
  assetId: string;
  kind: "asset" | "reference" | "character";
  title: string;
  type: AssetType;
  mimeType: string | null;
  previewUrl: string | null;
}

const LIMIT = 60;

/**
 * One kind of attachable source at a time — plain Assets (filtered to the
 * media types the model accepts), curated References, or curated Characters.
 * References/Characters are always offered regardless of the model's media
 * types since they're explicitly curated for reuse as generation input.
 */
export async function listAttachableItemsAction(
  dataTypes: string[],
  kind: "asset" | "reference" | "character",
  query?: string,
): Promise<AttachableItem[]> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }

  if (kind === "asset") {
    // "images"/"frames" both draw from image assets; normalize everything to real asset types.
    const assetTypeFilter = Array.from(
      new Set(
        dataTypes
          .map((t) => (t === "images" || t === "frames" ? "image" : t))
          .filter((t): t is AssetType => t === "image" || t === "audio" || t === "video"),
      ),
    );
    if (assetTypeFilter.length === 0) return [];

    const rows = await db
      .select()
      .from(assets)
      .where(and(inArray(assets.type, assetTypeFilter), query ? ilike(assets.title, `%${query}%`) : undefined))
      .orderBy(desc(assets.createdAt))
      .limit(LIMIT);
    return Promise.all(
      rows.map(async (row) => ({
        assetId: row.id,
        kind: "asset" as const,
        title: row.title,
        type: row.type as AssetType,
        mimeType: row.mimeType,
        previewUrl: await createDownloadUrl(row.previewKey ?? row.storageKey).catch(() => null),
      })),
    );
  }

  if (kind === "reference") {
    const rows = await db
      .select({ ref: references, asset: assets })
      .from(references)
      .innerJoin(assets, eq(assets.id, references.assetId))
      .where(query ? ilike(references.title, `%${query}%`) : undefined)
      .orderBy(desc(references.createdAt))
      .limit(LIMIT);
    return Promise.all(
      rows.map(async ({ ref, asset }) => ({
        assetId: asset.id,
        kind: "reference" as const,
        title: ref.title,
        type: asset.type as AssetType,
        mimeType: asset.mimeType,
        previewUrl: await createDownloadUrl(asset.previewKey ?? asset.storageKey).catch(() => null),
      })),
    );
  }

  const rows = await db
    .select({ character: characters, asset: assets })
    .from(characters)
    .innerJoin(assets, eq(assets.id, characters.referenceAssetId))
    .where(query ? ilike(characters.name, `%${query}%`) : undefined)
    .orderBy(desc(characters.createdAt))
    .limit(LIMIT);
  return Promise.all(
    rows.map(async ({ character, asset }) => ({
      assetId: asset.id,
      kind: "character" as const,
      title: character.name,
      type: asset.type as AssetType,
      mimeType: asset.mimeType,
      previewUrl: await createDownloadUrl(asset.previewKey ?? asset.storageKey).catch(() => null),
    })),
  );
}

export interface ResolvedAttachment {
  assetId: string;
  url: string;
  mimeType: string;
  type: AssetType;
  title: string;
}

/** Turns stable asset ids (e.g. from a Remix) back into fresh, currently-valid presigned URLs. */
export async function resolveAttachmentsAction(assetIds: string[]): Promise<ResolvedAttachment[]> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }
  if (assetIds.length === 0) return [];

  const rows = await db.select().from(assets).where(inArray(assets.id, assetIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const resolved = await Promise.all(
    assetIds.map(async (id) => {
      const row = byId.get(id);
      if (!row || !row.mimeType) return null;
      const url = await createDownloadUrl(row.storageKey).catch(() => null);
      if (!url) return null;
      return { assetId: row.id, url, mimeType: row.mimeType, type: row.type as AssetType, title: row.title };
    }),
  );
  return resolved.filter((r): r is ResolvedAttachment => r !== null);
}
