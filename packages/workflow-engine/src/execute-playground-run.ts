import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { assets, db, one, runs, runSteps } from "@superos/db";
import { estimateCost, getModelById } from "@superos/model-registry";
import { buildAssetStorageKey, putObject } from "@superos/storage";
import { getGenerationAdapter } from "./generation/registry";
import type { ReferenceInput } from "./generation/types";

export interface PlaygroundRunInput {
  modelId: string;
  prompt?: string;
  references?: ReferenceInput[];
  /** Stable asset ids behind `references` (in the same order) — persisted so a later Remix can resolve fresh URLs instead of reusing expired presigned ones. */
  referenceAssetIds?: string[];
  settings?: Record<string, unknown>;
  folderId: string | null;
  userId: string | null;
}

export interface RunStatusResult {
  runId: string;
  status: string;
  assetIds: string[];
  error?: string;
}

/**
 * Creates a queued run + run_step and returns immediately — actual
 * generation happens in `executeQueuedPlaygroundRun`, off the request
 * thread, via `workers/media`. Playground and Workflow both go through a
 * queue/worker layer this way; no generation call ever blocks an HTTP
 * request (relevant for Veo, which can poll for minutes).
 */
export async function createQueuedPlaygroundRun(input: PlaygroundRunInput): Promise<string> {
  const model = getModelById(input.modelId);
  if (!model) throw new Error(`Unknown model: ${input.modelId}`);

  const run = await one(
    db
      .insert(runs)
      .values({
        runScope: "playground",
        status: "queued",
        initiatedBy: input.userId,
        outputFolderId: input.folderId,
      })
      .returning(),
  );

  await db.insert(runSteps).values({
    runId: run.id,
    status: "queued",
    inputSnapshotJson: { prompt: input.prompt ?? null, references: input.references ?? [] },
    settingsSnapshotJson: {
      modelId: input.modelId,
      referenceAssetIds: input.referenceAssetIds ?? [],
      ...(input.settings ?? {}),
    },
  });

  return run.id;
}

/**
 * A run stuck at status "running" with no worker process actually working on
 * it is orphaned — the only thing that ever sets a run to "running" is the
 * worker process itself, so any such row still there when that worker
 * *starts up* can only mean the previous process died mid-generation (a
 * crash, or a deploy's `pm2 restart` killing it before it reached its own
 * catch block) and never got the chance to mark it failed. Call this once at
 * worker boot, scoped to the run scopes that worker owns, so those runs
 * don't sit "running" forever and silently hang the UI that's polling them.
 */
export async function reconcileOrphanedRuns(runScopes: string[]): Promise<number> {
  const orphaned = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(inArray(runs.runScope, runScopes), eq(runs.status, "running")));
  if (orphaned.length === 0) return 0;

  const message = "Generation was interrupted by a server restart before it finished — please try again.";
  for (const run of orphaned) {
    await db
      .update(runSteps)
      .set({ status: "failed", logsJson: [{ level: "error", message }], completedAt: new Date() })
      .where(and(eq(runSteps.runId, run.id), eq(runSteps.status, "running")));
    await db.update(runs).set({ status: "failed", failedAt: new Date() }).where(eq(runs.id, run.id));
  }
  return orphaned.length;
}

export async function getRunStatus(runId: string): Promise<RunStatusResult> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error(`Run not found: ${runId}`);
  const [step] = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).limit(1);

  const output = step?.outputSnapshotJson as { assetIds?: string[] } | undefined;
  const logs = step?.logsJson as { message?: string }[] | undefined;

  return {
    runId,
    status: run.status,
    assetIds: output?.assetIds ?? [],
    error: run.status === "failed" ? logs?.[0]?.message : undefined,
  };
}

/** Runs the actual generation for a queued run. Called by workers/media. */
export async function executeQueuedPlaygroundRun(runId: string): Promise<void> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error(`Run not found: ${runId}`);
  const [step] = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).limit(1);
  if (!step) throw new Error(`Run step not found for run: ${runId}`);

  const settings = step.settingsSnapshotJson as { modelId: string; count?: number; referenceAssetIds?: string[] } & Record<
    string,
    unknown
  >;
  const inputSnapshot = step.inputSnapshotJson as { prompt: string | null; references: ReferenceInput[] };
  const { modelId, count: rawCount, referenceAssetIds, ...restSettings } = settings;
  const count = Math.max(1, Math.min(50, Number(rawCount) || 1));
  const model = getModelById(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  await db.update(runs).set({ status: "running", startedAt: new Date() }).where(eq(runs.id, runId));
  await db.update(runSteps).set({ status: "running", startedAt: new Date() }).where(eq(runSteps.id, step.id));

  // Real provider billing isn't exposed via any adapter's response — the
  // most honest number we can attach is the same pricing-formula estimate
  // shown before generation, computed here with the actual final settings
  // that were used (not the pre-submit guess), one call at a time.
  const perCallCost = estimateCost({
    modelId,
    count: 1,
    seconds: Number(restSettings.durationSeconds ?? restSettings.duration ?? 1),
    characters: inputSnapshot.prompt?.length ?? 0,
    settings: restSettings,
  });
  const perCallCostUsd = perCallCost.verified ? perCallCost.estimatedUsd : null;

  const adapter = getGenerationAdapter(modelId);
  const assetIds: string[] = [];
  const failures: string[] = [];
  let totalCostUsd = 0;
  let anyCostVerified = false;

  for (let i = 0; i < count; i++) {
    try {
      const result = await adapter({
        modelId,
        prompt: inputSnapshot.prompt ?? undefined,
        references: inputSnapshot.references,
        settings: restSettings,
      });

      const costPerOutput = perCallCostUsd !== null ? perCallCostUsd / result.outputs.length : null;

      for (const output of result.outputs) {
        const ext = output.mimeType.split("/")[1]?.split(";")[0] ?? "bin";
        const key = buildAssetStorageKey("assets", `${model.id}-${randomUUID()}.${ext}`);
        await putObject(key, output.data, output.mimeType);

        const asset = await one(
          db
            .insert(assets)
            .values({
              type: output.type,
              mimeType: output.mimeType,
              title: inputSnapshot.prompt?.slice(0, 80) || model.label,
              folderId: run.outputFolderId,
              storageKey: key,
              sourceKind: "playground",
              sourceRunId: run.id,
              metadataJson: {
                modelId,
                prompt: inputSnapshot.prompt ?? null,
                settings: restSettings,
                referenceAssetIds: referenceAssetIds ?? [],
                costUsd: costPerOutput,
              },
              createdBy: run.initiatedBy,
            })
            .returning(),
        );
        assetIds.push(asset.id);
        if (costPerOutput !== null) {
          totalCostUsd += costPerOutput;
          anyCostVerified = true;
        }
      }
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (assetIds.length > 0) {
    await db
      .update(runSteps)
      .set({ status: "succeeded", outputSnapshotJson: { assetIds }, completedAt: new Date() })
      .where(eq(runSteps.id, step.id));
    await db
      .update(runs)
      .set({ status: "succeeded", completedAt: new Date(), actualCost: anyCostVerified ? totalCostUsd : null })
      .where(eq(runs.id, runId));
  } else {
    await db
      .update(runSteps)
      .set({ status: "failed", logsJson: [{ level: "error", message: failures[0] ?? "Generation failed" }], completedAt: new Date() })
      .where(eq(runSteps.id, step.id));
    await db
      .update(runs)
      .set({ status: "failed", failedAt: new Date() })
      .where(eq(runs.id, runId));
  }
}
