import type { GenerationInput, GenerationResult } from "../types";
import { ProviderNotConfiguredError } from "../types";

/**
 * AnyFast (https://docs.anyfast.ai) — an aggregator proxying Seedance,
 * Seedream, and Kling behind one API key. Confirmed against AnyFast's docs
 * for each model; adjust if their response shape changes (these are
 * third-party preview APIs).
 */
const ANYFAST_BASE = "https://www.anyfast.ai";

function requireApiKey(): string {
  const key = process.env.ANYFAST_API_KEY;
  if (!key) throw new ProviderNotConfiguredError("ANYFAST_API_KEY");
  return key;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function getTaskStatus(json: unknown): string | undefined {
  const data = asRecord(asRecord(json)?.data);
  const status = data?.status ?? asRecord(json)?.status;
  return typeof status === "string" ? status : undefined;
}

function getTaskFailReason(json: unknown): string {
  const data = asRecord(asRecord(json)?.data);
  const reason = data?.fail_reason;
  return typeof reason === "string" ? reason : JSON.stringify(json);
}

/** Recursively searches for the first `{ url: string }` inside any `videos`/`images` array — response nesting varies by model/task-query wrapper. */
function findOutputUrl(obj: unknown, keys: string[] = ["videos", "images"], depth = 0): string | undefined {
  if (depth > 6) return undefined;
  const record = asRecord(obj);
  if (!record) return undefined;

  for (const key of keys) {
    const arr = record[key];
    if (Array.isArray(arr)) {
      const first = asRecord(arr[0]);
      if (typeof first?.url === "string") return first.url;
    }
  }
  for (const value of Object.values(record)) {
    const found = findOutputUrl(value, keys, depth + 1);
    if (found) return found;
  }
  return undefined;
}

async function pollTask(
  getUrl: string,
  apiKey: string,
  extractUrl: (json: unknown) => string | undefined,
  { maxPolls = 90, intervalMs = 5000 } = {},
): Promise<string> {
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(getUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`AnyFast poll error: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const status = getTaskStatus(json);

    if (status === "SUCCESS" || status === "succeeded") {
      const url = extractUrl(json);
      if (!url) throw new Error("AnyFast task succeeded but no output URL was found in the response");
      return url;
    }
    if (status === "FAILED" || status === "failed") {
      throw new Error(`AnyFast task failed: ${getTaskFailReason(json)}`);
    }
  }
  throw new Error(`AnyFast task timed out polling ${getUrl}`);
}

async function downloadAsBuffer(url: string): Promise<{ data: Buffer; mimeType: string | null }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download AnyFast output: ${res.status}`);
  return { data: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get("content-type") };
}

export async function seedanceAdapter(input: GenerationInput): Promise<GenerationResult> {
  const apiKey = requireApiKey();
  if (!input.prompt) throw new Error("Seedance requires a text prompt");
  const settings = input.settings ?? {};

  const startRes = await fetch(`${ANYFAST_BASE}/v1/video/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "seedance-2.5",
      content: [{ type: "text", text: input.prompt }],
      generate_audio: settings.generateAudio ?? true,
      resolution: settings.resolution ?? "1080p",
      ratio: settings.ratio ?? "16:9",
      duration: settings.duration ?? 5,
    }),
  });
  if (!startRes.ok) throw new Error(`Seedance start error: ${startRes.status} ${await startRes.text()}`);
  const { task_id } = (await startRes.json()) as { task_id: string };

  const videoUrl = await pollTask(`${ANYFAST_BASE}/v1/video/generations/${task_id}`, apiKey, (json) => {
    const data = asRecord(asRecord(json)?.data);
    return typeof data?.result_url === "string" ? data.result_url : undefined;
  });

  const { data, mimeType } = await downloadAsBuffer(videoUrl);
  return { outputs: [{ type: "video", mimeType: mimeType?.includes("video") ? mimeType : "video/mp4", data }] };
}

export async function seedreamAdapter(input: GenerationInput): Promise<GenerationResult> {
  const apiKey = requireApiKey();
  if (!input.prompt) throw new Error("Seedream requires a text prompt");
  const settings = input.settings ?? {};

  const res = await fetch(`${ANYFAST_BASE}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "doubao-seedream-5-0-pro-260628",
      prompt: input.prompt,
      size: settings.size ?? "2K",
      output_format: settings.outputFormat ?? "png",
      response_format: "url",
      watermark: settings.watermark ?? false,
    }),
  });
  if (!res.ok) throw new Error(`Seedream error: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: { url?: string }[] };
  const url = json.data?.[0]?.url;
  if (!url) throw new Error("Seedream returned no image URL");

  const { data, mimeType } = await downloadAsBuffer(url);
  return { outputs: [{ type: "image", mimeType: mimeType?.includes("image") ? mimeType : "image/png", data }] };
}

export async function klingOmniAdapter(input: GenerationInput): Promise<GenerationResult> {
  const apiKey = requireApiKey();
  if (!input.prompt) throw new Error("Kling requires a text prompt");
  const settings = input.settings ?? {};

  const startRes = await fetch(`${ANYFAST_BASE}/kling/v1/videos/omni-video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_name: "kling-3.0-omni",
      prompt: input.prompt,
      duration: String(settings.duration ?? "5"),
      mode: settings.mode ?? "pro",
      aspect_ratio: settings.aspectRatio ?? "16:9",
    }),
  });
  if (!startRes.ok) throw new Error(`Kling start error: ${startRes.status} ${await startRes.text()}`);
  const { task_id } = (await startRes.json()) as { task_id: string };

  const videoUrl = await pollTask(`${ANYFAST_BASE}/kling/v1/videos/omni-video/${task_id}`, apiKey, (json) =>
    findOutputUrl(json, ["videos"]),
  );

  const { data, mimeType } = await downloadAsBuffer(videoUrl);
  return { outputs: [{ type: "video", mimeType: mimeType?.includes("video") ? mimeType : "video/mp4", data }] };
}
