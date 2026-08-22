import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageBucket, getStorageClient } from "./client";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
}

/**
 * Storage keys are content-addressed by a random id, independent of the
 * asset's folder — moving/renaming an asset in the Asset Library is a DB
 * operation only, never a storage move.
 */
export function buildAssetStorageKey(kind: "assets" | "previews", filename: string): string {
  return `${kind}/${randomUUID()}-${sanitizeFilename(filename)}`;
}

export async function createUploadUrl(
  key: string,
  contentType: string,
): Promise<{ url: string; key: string; expiresIn: number }> {
  const client = getStorageClient();
  const command = new PutObjectCommand({
    Bucket: getStorageBucket(),
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  return { url, key, expiresIn: UPLOAD_URL_TTL_SECONDS };
}

export async function createDownloadUrl(key: string, downloadFilename?: string): Promise<string> {
  const client = getStorageClient();
  const command = new GetObjectCommand({
    Bucket: getStorageBucket(),
    Key: key,
    ...(downloadFilename
      ? { ResponseContentDisposition: `attachment; filename="${sanitizeFilename(downloadFilename)}"` }
      : {}),
  });
  return getSignedUrl(client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

/** Reads an object's full bytes server-side — used for zipping a folder's assets into one download. */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const client = getStorageClient();
  const res = await client.send(new GetObjectCommand({ Bucket: getStorageBucket(), Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Direct server-side upload (used by the generation engine, which already
 * holds the output bytes in-process). Client-side uploads should use
 * `createUploadUrl` + a presigned PUT instead, so files never proxy through
 * the Next.js server.
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = getStorageClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getStorageBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  const client = getStorageClient();
  await client.send(new DeleteObjectCommand({ Bucket: getStorageBucket(), Key: key }));
}
