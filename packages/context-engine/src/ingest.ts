import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, knowledgeChunks, knowledgeSources, one } from "@superos/db";
import { chunkText } from "./chunk";
import { embedBatch } from "./embed";

export interface IngestSourceInput {
  sourceType: "repo" | "file" | "manual_note";
  sourceRef: string;
  title: string;
  content: string;
}

export interface IngestSourceResult {
  sourceId: string;
  skipped: boolean;
  chunkCount: number;
}

/**
 * Idempotent by content hash — re-running ingestion on an unchanged file is
 * a fast no-op instead of re-embedding (and re-billing) unnecessarily.
 */
export async function ingestSource(input: IngestSourceInput): Promise<IngestSourceResult> {
  const sourceHash = createHash("sha256").update(input.content).digest("hex");

  const [existing] = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.sourceRef, input.sourceRef))
    .limit(1);

  if (existing && existing.sourceHash === sourceHash) {
    return { sourceId: existing.id, skipped: true, chunkCount: 0 };
  }

  const source = existing
    ? one(
        db
          .update(knowledgeSources)
          .set({ sourceHash, title: input.title, active: true, syncedAt: new Date() })
          .where(eq(knowledgeSources.id, existing.id))
          .returning(),
      )
    : one(
        db
          .insert(knowledgeSources)
          .values({
            sourceType: input.sourceType,
            sourceRef: input.sourceRef,
            sourceHash,
            title: input.title,
            active: true,
            syncedAt: new Date(),
          })
          .returning(),
      );
  const resolvedSource = await source;

  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.knowledgeSourceId, resolvedSource.id));

  const chunks = chunkText(input.content);
  if (chunks.length === 0) {
    return { sourceId: resolvedSource.id, skipped: false, chunkCount: 0 };
  }

  const embeddings = await embedBatch(chunks);
  await db.insert(knowledgeChunks).values(
    chunks.map((content, i) => ({
      knowledgeSourceId: resolvedSource.id,
      content,
      embedding: embeddings[i],
      metadataJson: { chunkIndex: i },
    })),
  );

  return { sourceId: resolvedSource.id, skipped: false, chunkCount: chunks.length };
}
