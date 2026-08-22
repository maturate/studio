import { S3Client } from "@aws-sdk/client-s3";

let cached: S3Client | undefined;

/**
 * Works against Cloudflare R2 in hosted environments and any S3-compatible
 * endpoint (MinIO) locally — same adapter, just different env vars.
 */
export function getStorageClient(): S3Client {
  if (!cached) {
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "Storage is not configured: STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY must be set",
      );
    }

    cached = new S3Client({
      endpoint,
      region: process.env.STORAGE_REGION || "auto",
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }
  return cached;
}

export function getStorageBucket(): string {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("STORAGE_BUCKET is not set");
  }
  return bucket;
}
