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
  /** Pulls the direct video URL out of one dataset item — shape varies wildly per actor. */
  extractUrl: (item: Record<string, unknown>) => string | undefined;
}

/** Checks a flat top-level field list, in order, for a plain http(s) string value. */
function flatFieldExtractor(fields: string[]): (item: Record<string, unknown>) => string | undefined {
  return (item) => {
    for (const field of fields) {
      const value = item[field];
      if (typeof value === "string" && value.startsWith("http")) return value;
    }
    return undefined;
  };
}

/** presetshubham/instagram-reel-downloader kept getting rate-limited by Instagram itself
 * ("please wait a few minutes") — switched to Apify's own official scraper. */
const INSTAGRAM_ACTOR: ActorSpec = {
  id: "apify/instagram-reel-scraper",
  input: (url) => ({ username: [url] }),
  extractUrl: flatFieldExtractor(["videoUrl", "video_url", "downloadUrl"]),
};

/** apilabs/youtube-shorts-downloader is a rental actor — replaced after its free trial expired
 * with the pay-per-event easyapi actor, which bills straight from platform credit (no rental gate). */
const YOUTUBE_SHORTS_ACTOR: ActorSpec = {
  id: "easyapi/youtube-shorts-downloader",
  input: (url) => ({ links: [url] }),
  extractUrl: (item) => {
    const result = (item.result ?? item) as Record<string, unknown>;
    const medias = result.medias;
    if (!Array.isArray(medias)) return undefined;
    const videos = medias.filter(
      (m): m is Record<string, unknown> =>
        !!m && typeof m === "object" && (m as Record<string, unknown>).type === "video",
    );
    const best = videos.sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0))[0];
    const url = best?.url;
    return typeof url === "string" ? url : undefined;
  },
};

const YOUTUBE_VIDEO_ACTOR: ActorSpec = {
  id: "streamers/youtube-video-downloader",
  input: (url) => ({ videos: [{ url }] }),
  extractUrl: flatFieldExtractor(["downloadedFileUrl", "downloadUrl", "download_link", "videoUrl", "video_url"]),
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

async function getFirstItemUrl(datasetId: string, actor: ActorSpec, apiKey: string): Promise<string> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&clean=true`);
  if (!res.ok) throw new Error(`Apify dataset fetch error: ${res.status} ${await res.text()}`);
  const items = (await res.json()) as Record<string, unknown>[];
  const url = items[0] && actor.extractUrl(items[0]);
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
