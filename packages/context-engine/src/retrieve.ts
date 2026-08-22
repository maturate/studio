import { sql } from "drizzle-orm";
import { db } from "@superos/db";
import { embedText, toVectorLiteral } from "./embed";
import { getVertexAccessToken, vertexModelUrl } from "./vertex-auth";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceRef: string;
  content: string;
  similarity: number;
}

interface ChunkRow {
  chunk_id: string;
  source_id: string;
  source_title: string;
  source_ref: string;
  content: string;
  similarity: number;
}

function mapRow(r: ChunkRow): RetrievedChunk {
  return {
    chunkId: r.chunk_id,
    sourceId: r.source_id,
    sourceTitle: r.source_title,
    sourceRef: r.source_ref,
    content: r.content,
    similarity: Number(r.similarity),
  };
}

/**
 * "Suggested context" mode (AGENTS.md §11.3): plain semantic top-K over all
 * active knowledge sources.
 */
export async function retrieveContext(query: string, topK = 8): Promise<RetrievedChunk[]> {
  const literal = toVectorLiteral(await embedText(query));

  const rows = (await db.execute(sql`
    SELECT
      kc.id as chunk_id,
      ks.id as source_id,
      ks.title as source_title,
      ks.source_ref as source_ref,
      kc.content as content,
      1 - (kc.embedding <=> ${literal}::vector) as similarity
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON ks.id = kc.knowledge_source_id
    WHERE ks.active = true
    ORDER BY kc.embedding <=> ${literal}::vector
    LIMIT ${topK}
  `)) as unknown as ChunkRow[];

  return rows.map(mapRow);
}

/**
 * "Pinned context pack" mode: restricts retrieval to a specific set of
 * source refs instead of searching the whole knowledge base.
 */
export async function retrieveFromSources(
  query: string,
  sourceRefs: string[],
  topK = 8,
): Promise<RetrievedChunk[]> {
  if (sourceRefs.length === 0) return [];
  const literal = toVectorLiteral(await embedText(query));

  const rows = (await db.execute(sql`
    SELECT
      kc.id as chunk_id,
      ks.id as source_id,
      ks.title as source_title,
      ks.source_ref as source_ref,
      kc.content as content,
      1 - (kc.embedding <=> ${literal}::vector) as similarity
    FROM knowledge_chunks kc
    JOIN knowledge_sources ks ON ks.id = kc.knowledge_source_id
    WHERE ks.active = true AND ks.source_ref = ANY(${sourceRefs})
    ORDER BY kc.embedding <=> ${literal}::vector
    LIMIT ${topK}
  `)) as unknown as ChunkRow[];

  return rows.map(mapRow);
}

/**
 * "Agentic context retrieval" mode: expands the query into a few related
 * sub-queries with Gemini, retrieves for each, then merges and dedupes by
 * chunk id, keeping the highest similarity seen. Deliberately simple —
 * multi-query expansion, not a full agent loop — but genuinely broadens
 * recall past a single embedding lookup.
 */
export async function retrieveContextAgentic(query: string, topK = 8): Promise<RetrievedChunk[]> {
  const token = await getVertexAccessToken();

  // gemini-omni-flash-preview cannot be called via generateContent at all (Vertex rejects it —
  // it's video-only, behind a separate Interactions API). gemini-2.5-flash is a real text model.
  const res = await fetch(
    vertexModelUrl("gemini-2.5-flash", "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Given this content-generation query for the superOS knowledge base, list 3 short related search queries that would surface useful supporting context. Query: "${query}". Respond with one query per line, no numbering.`,
              },
            ],
          },
        ],
      }),
    },
  );

  const subQueries = [query];
  if (res.ok) {
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    subQueries.push(
      ...text
        .split("\n")
        .map((l) => l.replace(/^[-\d.]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 3),
    );
  }

  const merged = new Map<string, RetrievedChunk>();
  for (const q of subQueries) {
    const results = await retrieveContext(q, topK);
    for (const chunk of results) {
      const existing = merged.get(chunk.chunkId);
      if (!existing || chunk.similarity > existing.similarity) {
        merged.set(chunk.chunkId, chunk);
      }
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
