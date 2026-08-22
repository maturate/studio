"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { assets, db, logAudit, one, references } from "@superos/db";
import { auth } from "@/lib/auth";
import { requestUploadUrlAction } from "@/features/assets/actions";

export { requestUploadUrlAction };

export async function createReferenceAction(input: {
  type: string;
  title: string;
  description: string;
  storageKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}) {
  const session = await auth();
  const isImage = input.contentType.startsWith("image/");

  const asset = await one(
    db
      .insert(assets)
      .values({
        type: isImage ? "image" : input.contentType.startsWith("audio/") ? "audio" : input.contentType.startsWith("video/") ? "video" : "text",
        mimeType: input.contentType,
        title: input.filename,
        storageKey: input.storageKey,
        sourceKind: "reference",
        metadataJson: { sizeBytes: input.sizeBytes },
        createdBy: session?.user?.id ?? null,
      })
      .returning(),
  );

  const reference = await one(
    db
      .insert(references)
      .values({
        type: input.type,
        title: input.title,
        description: input.description || null,
        assetId: asset.id,
        createdBy: session?.user?.id ?? null,
      })
      .returning(),
  );

  revalidatePath("/references");
  return reference;
}

export async function deleteReferenceAction(id: string) {
  await db.delete(references).where(eq(references.id, id));
  const session = await auth();
  await logAudit({ actorId: session?.user?.id ?? null, action: "delete", entityType: "reference", entityId: id });
  revalidatePath("/references");
}
