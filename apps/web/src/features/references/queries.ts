import { asc, eq } from "drizzle-orm";
import { assets, db, references } from "@superos/db";
import { createDownloadUrl } from "@superos/storage";

export async function listReferencesWithPreview() {
  const rows = await db
    .select({
      id: references.id,
      type: references.type,
      title: references.title,
      description: references.description,
      assetId: references.assetId,
      storageKey: assets.storageKey,
      mimeType: assets.mimeType,
    })
    .from(references)
    .leftJoin(assets, eq(assets.id, references.assetId))
    .orderBy(asc(references.title));

  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      previewUrl: r.storageKey ? await createDownloadUrl(r.storageKey).catch(() => null) : null,
    })),
  );
}
