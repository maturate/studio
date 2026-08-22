import { and, desc, eq, sql } from "drizzle-orm";
import { db, runs, runSteps } from "@superos/db";
import { getAssetPreviews, type AssetPreview } from "@/features/assets/queries";

export interface LatestPlaygroundRun {
  runId: string;
  status: string;
  /** Output count the run was started with — used to render the right number of shimmer placeholders when resuming a poll. */
  count: number;
  error?: string;
  outputs: AssetPreview[];
}

/**
 * The user's single most recent Playground run for a specific model, regardless
 * of status — used to restore the output box on page load/refresh/model switch,
 * scoped so switching model or category never shows another model's outputs.
 */
export async function getLatestPlaygroundRun(userId: string, modelId: string): Promise<LatestPlaygroundRun | null> {
  const rows = await db
    .select({ run: runs, step: runSteps })
    .from(runs)
    .innerJoin(runSteps, eq(runSteps.runId, runs.id))
    .where(
      and(
        eq(runs.runScope, "playground"),
        eq(runs.initiatedBy, userId),
        sql`${runSteps.settingsSnapshotJson} ->> 'modelId' = ${modelId}`,
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const settings = row.step.settingsSnapshotJson as { count?: number } | undefined;
  const output = row.step.outputSnapshotJson as { assetIds?: string[] } | undefined;
  const logs = row.step.logsJson as { message?: string }[] | undefined;

  const outputs = row.run.status === "succeeded" ? await getAssetPreviews(output?.assetIds ?? []) : [];

  return {
    runId: row.run.id,
    status: row.run.status,
    count: Math.max(1, Number(settings?.count) || 1),
    error: row.run.status === "failed" ? (logs?.[0]?.message ?? "Generation failed") : undefined,
    outputs,
  };
}
