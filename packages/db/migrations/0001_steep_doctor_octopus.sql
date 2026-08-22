ALTER TABLE "knowledge_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);