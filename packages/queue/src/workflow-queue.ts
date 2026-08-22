import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const WORKFLOW_QUEUE_NAME = "workflow-runs";

export interface WorkflowRunJob {
  runId: string;
}

let cached: Queue<WorkflowRunJob> | undefined;

export function getWorkflowQueue(): Queue<WorkflowRunJob> {
  if (!cached) {
    cached = new Queue<WorkflowRunJob>(WORKFLOW_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return cached;
}

export async function enqueueWorkflowRun(runId: string): Promise<void> {
  await getWorkflowQueue().add("run", { runId });
}
