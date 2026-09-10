"use server";

import { randomUUID } from "node:crypto";
import { assets, db } from "@superos/db";
import { buildAssetStorageKey, putObject } from "@superos/storage";
import { geminiGenerateText } from "@superos/workflow-engine";
import { retrieveContext, type RetrievedChunk } from "@superos/context-engine";
import { auth } from "@/lib/auth";
import { getScriptSeries } from "./script-series";

// Confirmed live against this project before switching — 3.7-flash was
// struggling to hold the character voice without very heavy prompting.
const SCRIPT_MODEL = "gemini-3.8-flash";
const BRAND_QUERY = "superOS brand voice, tone, writing rules, positioning, what superOS actually does";

function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim()) out.push(value.trim());
  } else if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) flattenStrings(v, out);
  }
  return out;
}

function dedupeChunks(chunkLists: RetrievedChunk[][]): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();
  for (const list of chunkLists) {
    for (const chunk of list) {
      const existing = byId.get(chunk.chunkId);
      if (!existing || chunk.similarity > existing.similarity) byId.set(chunk.chunkId, chunk);
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.similarity - a.similarity);
}

function formatContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const body = chunks.map((c) => `[${c.sourceTitle}]\n${c.content}`).join("\n\n");
  return `KNOWLEDGE BASE CONTEXT — ground this script in the real brand voice and this series' actual documented mechanic. Don't contradict anything below; don't invent product claims not supported here:\n\n${body}\n\n---\n\n`;
}

/**
 * Turns a provider failure into something the operator can act on. Worth doing
 * properly because a thrown Server Action error reaches the browser as a bare
 * "Minified React error #441" in production — Next strips the message to avoid
 * leaking server details, so anything we want the user to read has to travel
 * back as data instead.
 */
function describeFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429")) {
    return `Vertex AI is rate-limited right now (429). ${SCRIPT_MODEL} has a per-minute quota and we already retried twice. Wait about a minute and generate again.`;
  }
  if (raw.includes("403") || raw.includes("PERMISSION_DENIED")) {
    return `Vertex AI refused the request for ${SCRIPT_MODEL} (403). The model may not be enabled for this project.`;
  }
  if (raw.includes("returned no text")) {
    return "The model returned an empty response — usually a safety filter on the source material. Try rewording the situation or the chatbot answers.";
  }
  return raw;
}

export async function generateScriptAction(
  seriesId: string,
  values: Record<string, unknown>,
): Promise<{ script: string | null; assetId: string | null; error: string | null }> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    return { script: null, assetId: null, error: "Not authorized" };
  }

  const series = getScriptSeries(seriesId);
  if (!series) return { script: null, assetId: null, error: `Unknown script series: ${seriesId}` };
  if (series.mode !== "ai" || !series.buildPrompt) {
    return { script: null, assetId: null, error: `${series.label} is written manually — there's nothing to generate.` };
  }

  const seriesQuery = [series.label, series.character, ...flattenStrings(values)].join(" — ").slice(0, 2000);
  const [brandChunks, seriesChunks] = await Promise.all([
    retrieveContext(BRAND_QUERY, 4),
    retrieveContext(seriesQuery, 6),
  ]);
  const contextBlock = formatContextBlock(dedupeChunks([brandChunks, seriesChunks]).slice(0, 10));

  const prompt = contextBlock + series.buildPrompt(values);
  let script: string;
  try {
    script = await geminiGenerateText(prompt, SCRIPT_MODEL);
  } catch (err) {
    console.error("Script generation failed", err);
    return { script: null, assetId: null, error: describeFailure(err) };
  }

  const key = buildAssetStorageKey("assets", `script-${randomUUID()}.txt`);
  await putObject(key, Buffer.from(script, "utf-8"), "text/plain");

  const [asset] = await db
    .insert(assets)
    .values({
      type: "text",
      mimeType: "text/plain",
      title: script.slice(0, 80) || series.label,
      storageKey: key,
      sourceKind: "script",
      metadataJson: { seriesId, seriesLabel: series.label, inputs: values },
      createdBy: session.user.id,
    })
    .returning();

  return { script, assetId: asset?.id ?? null, error: null };
}
