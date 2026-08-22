import { ProviderNotConfiguredError } from "../types";

/**
 * Apify (apify.com) actors used to fetch a real video file for a
 * YouTube/Instagram link before handing it to ElevenLabs STT — ElevenLabs'
 * own `source_url` fetch is unreliable against both hosts.
 */
const APIFY_BASE = "https://api.apify.com/v2";

function requireApiKey(): string {
  const key = process.env.APIFY_API_KEY;
  if (!key) throw new ProviderNotConfiguredError("APIFY_API_KEY");
  return key;
}

interface ActorSpec {
  /** "owner/actor-name" — turned into "owner~actor-name" for the REST path. */
  id: string;
  input: (url: string) => Record<string, unknown>;
  /** Field name(s) on the dataset item that hold the direct video URL, checked in order. */
  urlFields: string[];
}

const INSTAGRAM_ACTOR: ActorSpec = {
  id: "presetshubham/instagram-reel-downloader",
  input: (url) => ({ reelLinks: [url] }),
  urlFields: ["video_url", "videoUrl", "downloadUrl"],
};

const YOUTUBE_SHORTS_ACTOR: ActorSpec = {
  id: "apilabs/youtube-shorts-downloader",
  input: (url) => ({ urls: [url] }),
  urlFields: ["download_link", "downloadLink", "downloadUrl"],
};

const YOUTUBE_VIDEO_ACTOR: ActorSpec = {
  id: "streamers/youtube-video-downloader",
  input: (url) => ({ videos: [{ url }] }),
  urlFields: ["downloadUrl", "download_link", "videoUrl", "video_url", "url"],
};

function pickActor(sourceUrl: string): ActorSpec {
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  if (host === "instagram.com") return INSTAGRAM_ACTOR;
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    return /\/shorts\//.test(sourceUrl) ? YOUTUBE_SHORTS_ACTOR : YOUTUBE_VIDEO_ACTOR;
  }
  throw new Error(`No Apify actor configured for host: ${host}`);
}

async function startRun(actor: ActorSpec, sourceUrl: string, apiKey: string): Promise<string> {
  const actorPath = actor.id.replace("/", "~");
  const res = await fetch(`${APIFY_BASE}/acts/${actorPath}/runs?token=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(actor.input(sourceUrl)),
  });
  if (!res.ok) throw new Error(`Apify run start error (${actor.id}): ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}

async function pollRun(
  runId: string,
  apiKey: string,
  { maxPolls = 60, intervalMs = 5000 } = {},
): Promise<string> {
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`);
    if (!res.ok) throw new Error(`Apify poll error: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { data: { status: string; defaultDatasetId: string } };
    if (json.data.status === "SUCCEEDED") return json.data.defaultDatasetId;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(json.data.status)) {
      throw new Error(`Apify run ${runId} ended with status ${json.data.status}`);
    }
  }
  throw new Error(`Apify run ${runId} timed out polling`);
}

function findUrlField(item: Record<string, unknown>, fields: string[]): string | undefined {
  for (const field of fields) {
    const value = item[field];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }
  return undefined;
}

async function getFirstItemUrl(datasetId: string, actor: ActorSpec, apiKey: string): Promise<string> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&clean=true`);
  if (!res.ok) throw new Error(`Apify dataset fetch error: ${res.status} ${await res.text()}`);
  const items = (await res.json()) as Record<string, unknown>[];
  const url = items[0] && findUrlField(items[0], actor.urlFields);
  if (!url) throw new Error(`Apify actor ${actor.id} returned no downloadable video URL`);
  return url;
}

/** Downloads a YouTube/Instagram video via the matching Apify actor and returns its bytes. */
export async function downloadSocialVideo(sourceUrl: string): Promise<{ data: Buffer; mimeType: string }> {
  const apiKey = requireApiKey();
  const actor = pickActor(sourceUrl);

  const runId = await startRun(actor, sourceUrl, apiKey);
  const datasetId = await pollRun(runId, apiKey);
  const videoUrl = await getFirstItemUrl(datasetId, actor, apiKey);

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Could not download Apify output video: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "video/mp4";
  return { data: Buffer.from(await res.arrayBuffer()), mimeType };
}

/** True for links Apify can fetch — everything else (e.g. our own presigned upload URLs) passes through untouched. */
export function isSocialVideoUrl(sourceUrl: string): boolean {
  try {
    pickActor(sourceUrl);
    return true;
  } catch {
    return false;
  }
}
