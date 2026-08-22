import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const MEDIA_QUEUE_NAME = "media-runs";

export interface MediaRunJob {
  runId: string;
}

let cached: Queue<MediaRunJob> | undefined;

export function getMediaQueue(): Queue<MediaRunJob> {
  if (!cached) {
    cached = new Queue<MediaRunJob>(MEDIA_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return cached;
}

export async function enqueueMediaRun(runId: string): Promise<void> {
  await getMediaQueue().add("run", { runId });
}
