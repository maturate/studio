"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { assets, characters, db, logAudit, one } from "@superos/db";
import { auth } from "@/lib/auth";
import { requestUploadUrlAction } from "@/features/assets/actions";

export { requestUploadUrlAction };

export async function createCharacterAction(input: {
  name: string;
  description: string;
  storageKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}) {
  const session = await auth();

  const asset = await one(
    db
      .insert(assets)
      .values({
        type: input.contentType.startsWith("image/") ? "image" : "text",
        mimeType: input.contentType,
        title: input.filename,
        storageKey: input.storageKey,
        sourceKind: "character",
        metadataJson: { sizeBytes: input.sizeBytes },
        createdBy: session?.user?.id ?? null,
      })
      .returning(),
  );

  const character = await one(
    db
      .insert(characters)
      .values({
        name: input.name,
        description: input.description || null,
        referenceAssetId: asset.id,
        createdBy: session?.user?.id ?? null,
      })
      .returning(),
  );

  revalidatePath("/characters");
  return character;
}

export async function deleteCharacterAction(id: string) {
  await db.delete(characters).where(eq(characters.id, id));
  const session = await auth();
  await logAudit({ actorId: session?.user?.id ?? null, action: "delete", entityType: "character", entityId: id });
  revalidatePath("/characters");
}
