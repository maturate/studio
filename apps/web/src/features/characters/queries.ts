import { asc, eq } from "drizzle-orm";
import { assets, characters, db } from "@superos/db";
import { createDownloadUrl } from "@superos/storage";

export async function listCharactersWithPreview() {
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      referenceAssetId: characters.referenceAssetId,
      storageKey: assets.storageKey,
      mimeType: assets.mimeType,
    })
    .from(characters)
    .leftJoin(assets, eq(assets.id, characters.referenceAssetId))
    .orderBy(asc(characters.name));

  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      previewUrl: r.storageKey ? await createDownloadUrl(r.storageKey).catch(() => null) : null,
    })),
  );
}
