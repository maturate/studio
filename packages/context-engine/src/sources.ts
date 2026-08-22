import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, knowledgeChunks, knowledgeSources } from "@superos/db";

export async function listKnowledgeSources() {
  return db
    .select({
      id: knowledgeSources.id,
      title: knowledgeSources.title,
      sourceRef: knowledgeSources.sourceRef,
      sourceType: knowledgeSources.sourceType,
      active: knowledgeSources.active,
      syncedAt: knowledgeSources.syncedAt,
      chunkCount: sql<number>`count(${knowledgeChunks.id})`.mapWith(Number),
    })
    .from(knowledgeSources)
    .leftJoin(knowledgeChunks, eq(knowledgeChunks.knowledgeSourceId, knowledgeSources.id))
    .groupBy(knowledgeSources.id)
    .orderBy(desc(knowledgeSources.syncedAt));
}

/**
 * All chunks for a fixed set of source refs, no similarity search — used
 * when a Context Pack is injected as a flat pin rather than a query-scoped
 * retrieval (AGENTS.md §11.3 "pinned context pack" mode).
 */
export async function getChunksForSourceRefs(sourceRefs: string[], limit = 20) {
  if (sourceRefs.length === 0) return [];
  return db
    .select({
      sourceRef: knowledgeSources.sourceRef,
      sourceTitle: knowledgeSources.title,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeSources, eq(knowledgeSources.id, knowledgeChunks.knowledgeSourceId))
    .where(inArray(knowledgeSources.sourceRef, sourceRefs))
    .limit(limit);
}
