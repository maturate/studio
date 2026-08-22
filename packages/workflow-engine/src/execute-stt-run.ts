import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { assets, db, one, runs, runSteps } from "@superos/db";
import { buildAssetStorageKey, createDownloadUrl, putObject } from "@superos/storage";
import { downloadSocialVideo, isSocialVideoUrl } from "./generation/providers/apify";
import { elevenLabsTranscribe } from "./generation/providers/elevenlabs";
import { geminiSummarizeTranscript } from "./generation/providers/google";

export interface SttRunInput {
  /** A YouTube/TikTok URL, or a hosted (presigned) URL to an uploaded video — ElevenLabs fetches it directly. */
  sourceUrl: string;
  userId: string | null;
  /** Target summary length in words. 0 skips the summary step entirely. */
  summaryWords: number;
}

export interface SttRunStatusResult {
  runId: string;
  status: string;
  transcript?: string;
  summary?: string;
  languageCode?: string | null;
  assetId?: string;
  error?: string;
}

export async function createQueuedSttRun(input: SttRunInput): Promise<string> {
  const run = await one(
    db.insert(runs).values({ runScope: "stt", status: "queued", initiatedBy: input.userId }).returning(),
  );
  await db.insert(runSteps).values({
    runId: run.id,
    status: "queued",
    inputSnapshotJson: { sourceUrl: input.sourceUrl },
    settingsSnapshotJson: { summaryWords: input.summaryWords },
  });
  return run.id;
}

/** Runs transcription + summary for a queued STT run, then saves the result as a text asset. Called by workers/media. */
export async function executeQueuedSttRun(runId: string): Promise<void> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error(`Run not found: ${runId}`);
  const [step] = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).limit(1);
  if (!step) throw new Error(`Run step not found for run: ${runId}`);

  const inputSnapshot = step.inputSnapshotJson as { sourceUrl: string };
  const settingsSnapshot = step.settingsSnapshotJson as { summaryWords?: number } | undefined;
  const summaryWords = settingsSnapshot?.summaryWords ?? 200;

  await db.update(runs).set({ status: "running", startedAt: new Date() }).where(eq(runs.id, runId));
  await db.update(runSteps).set({ status: "running", startedAt: new Date() }).where(eq(runSteps.id, step.id));

  try {
    let transcribeUrl = inputSnapshot.sourceUrl;
    if (isSocialVideoUrl(transcribeUrl)) {
      const { data, mimeType } = await downloadSocialVideo(transcribeUrl);
      const ext = mimeType.includes("mp4") ? "mp4" : "bin";
      const key = buildAssetStorageKey("assets", `apify-${randomUUID()}.${ext}`);
      await putObject(key, data, mimeType);
      transcribeUrl = await createDownloadUrl(key);
    }
    const { text, languageCode } = await elevenLabsTranscribe(transcribeUrl);
    const summary = summaryWords > 0 ? await geminiSummarizeTranscript(text, summaryWords) : null;

    const title = (summary ?? text).slice(0, 80) || "Transcription";
    const fileBody = [summary ? `SUMMARY:\n${summary}\n\nTRANSCRIPT:\n${text}` : `TRANSCRIPT:\n${text}`].join("");
    const key = buildAssetStorageKey("assets", `stt-${randomUUID()}.txt`);
    await putObject(key, Buffer.from(fileBody, "utf-8"), "text/plain");

    const asset = await one(
      db
        .insert(assets)
        .values({
          type: "text",
          mimeType: "text/plain",
          title,
          storageKey: key,
          sourceKind: "stt",
          sourceRunId: run.id,
          metadataJson: { sourceUrl: inputSnapshot.sourceUrl, languageCode, summaryWords },
          createdBy: run.initiatedBy,
        })
        .returning(),
    );

    await db
      .update(runSteps)
      .set({
        status: "succeeded",
        outputSnapshotJson: { transcript: text, summary, languageCode, assetId: asset.id },
        completedAt: new Date(),
      })
      .where(eq(runSteps.id, step.id));
    await db.update(runs).set({ status: "succeeded", completedAt: new Date() }).where(eq(runs.id, runId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(runSteps)
      .set({ status: "failed", logsJson: [{ level: "error", message }], completedAt: new Date() })
      .where(eq(runSteps.id, step.id));
    await db.update(runs).set({ status: "failed", failedAt: new Date() }).where(eq(runs.id, runId));
  }
}

export async function getSttRunStatus(runId: string): Promise<SttRunStatusResult> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error(`Run not found: ${runId}`);
  const [step] = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).limit(1);

  const output = step?.outputSnapshotJson as
    | { transcript?: string; summary?: string; languageCode?: string | null; assetId?: string }
    | undefined;
  const logs = step?.logsJson as { message?: string }[] | undefined;

  return {
    runId,
    status: run.status,
    transcript: output?.transcript,
    summary: output?.summary,
    languageCode: output?.languageCode,
    assetId: output?.assetId,
    error: run.status === "failed" ? logs?.[0]?.message : undefined,
  };
}
