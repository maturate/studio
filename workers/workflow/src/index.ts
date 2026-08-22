import { Worker } from "bullmq";
import { getRedisConnection, WORKFLOW_QUEUE_NAME, type WorkflowRunJob } from "@superos/queue";
import { reconcileOrphanedRuns, runWorkflow } from "@superos/workflow-engine";

async function main() {
  const reconciled = await reconcileOrphanedRuns(["workflow_node", "workflow_branch", "workflow_full"]).catch((err) => {
    console.error("[worker:workflow] reconcileOrphanedRuns failed:", err.message);
    return 0;
  });
  if (reconciled > 0) {
    console.log(`[worker:workflow] reconciled ${reconciled} run(s) orphaned by a previous restart`);
  }

  const worker = new Worker<WorkflowRunJob>(
    WORKFLOW_QUEUE_NAME,
    async (job) => {
      console.log(`[worker:workflow] running run ${job.data.runId}`);
      await runWorkflow(job.data.runId);
      console.log(`[worker:workflow] finished run ${job.data.runId}`);
    },
    { connection: getRedisConnection(), concurrency: 4 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker:workflow] run ${job?.data.runId} failed:`, err.message);
  });

  console.log("[worker:workflow] listening on queue:", WORKFLOW_QUEUE_NAME);

  // Let in-flight jobs finish before pm2 kills the process on restart/deploy,
  // instead of abandoning them mid-generation.
  process.on("SIGTERM", async () => {
    console.log("[worker:workflow] SIGTERM received, waiting for active jobs to finish…");
    await worker.close();
    process.exit(0);
  });
}

main();
