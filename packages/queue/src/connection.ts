import IORedis from "ioredis";

let cached: IORedis | undefined;

export function getRedisConnection(): IORedis {
  if (!cached) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    // Required by BullMQ when a shared connection is reused across queues/workers.
    cached = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return cached;
}
