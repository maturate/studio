import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db, runs } from "@superos/db";
import { getRedisConnection, MEDIA_QUEUE_NAME, type MediaRunJob } from "@superos/queue";
import { executeQueuedPlaygroundRun, executeQueuedSttRun, reconcileOrphanedRuns } from "@superos/workflow-engine";

async function main() {
  const reconciled = await reconcileOrphanedRuns(["playground", "stt"]).catch((err) => {
    console.error("[worker:media] reconcileOrphanedRuns failed:", err.message);
    return 0;
  });
  if (reconciled > 0) {
    console.log(`[worker:media] reconciled ${reconciled} run(s) orphaned by a previous restart`);
  }

  const worker = new Worker<MediaRunJob>(
    MEDIA_QUEUE_NAME,
    async (job) => {
      console.log(`[worker:media] running run ${job.data.runId}`);
      const [run] = await db.select({ runScope: runs.runScope }).from(runs).where(eq(runs.id, job.data.runId)).limit(1);
      if (run?.runScope === "stt") {
        await executeQueuedSttRun(job.data.runId);
      } else {
        await executeQueuedPlaygroundRun(job.data.runId);
      }
      console.log(`[worker:media] finished run ${job.data.runId}`);
    },
    { connection: getRedisConnection(), concurrency: 4 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker:media] run ${job?.data.runId} failed:`, err.message);
  });

  console.log("[worker:media] listening on queue:", MEDIA_QUEUE_NAME);

  // Let in-flight jobs finish before pm2 kills the process on restart/deploy,
  // instead of abandoning them mid-generation (which is what left runs stuck at
  // status "running" forever — see reconcileOrphanedRuns above).
  process.on("SIGTERM", async () => {
    console.log("[worker:media] SIGTERM received, waiting for active jobs to finish…");
    await worker.close();
    process.exit(0);
  });
}

main();
