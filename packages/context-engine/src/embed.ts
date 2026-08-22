import { getVertexAccessToken, vertexModelUrl } from "./vertex-auth";

export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const GEMINI_EMBEDDING_DIMENSIONS = 768;

/**
 * Vertex AI's `:predict` embedding contract differs from the public
 * Generative Language API's `:embedContent` — `instances`/`parameters` in,
 * `predictions[].embeddings.values` out.
 */
export async function embedText(text: string): Promise<number[]> {
  const token = await getVertexAccessToken();
  const res = await fetch(vertexModelUrl(GEMINI_EMBEDDING_MODEL, "predict"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      instances: [{ content: text, task_type: "RETRIEVAL_DOCUMENT" }],
      parameters: { outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS },
    }),
  });
  if (!res.ok) {
    throw new Error(`Vertex AI embedding error: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { predictions?: { embeddings?: { values: number[] } }[] };
  const values = json.predictions?.[0]?.embeddings?.values;
  if (!values) throw new Error("Vertex AI embedding response had no values");
  return values;
}

/** Batches sequentially to stay well under per-minute rate limits for an internal tool's ingest jobs. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedText(text));
  }
  return results;
}

export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
