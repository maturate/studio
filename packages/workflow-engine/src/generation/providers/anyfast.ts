import type { GenerationInput, GenerationResult, ReferenceInput } from "../types";
import { ProviderNotConfiguredError } from "../types";

/**
 * AnyFast (https://docs.anyfast.ai) — aggregator for Seedance, Seedream, and
 * Kling. Adapters below mirror the documented request shapes for each model
 * family (multimodal content, settings knobs, and output polling).
 */
const ANYFAST_BASE = "https://www.anyfast.ai";

const SEEDANCE_MODELS = new Set(["seedance-2.5", "seedance-2.5-nsfw", "seedance-2.0-nsfw"]);
const SEEDANCE_2_5_MODELS = new Set(["seedance-2.5", "seedance-2.5-nsfw"]);

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

/** Recursively searches for the first `{ url: string }` inside any named array key. */
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

/** Prefer explicit string URL fields often used for Seedance last-frame / result links. */
function findNamedUrl(obj: unknown, names: string[], depth = 0): string | undefined {
  if (depth > 6) return undefined;
  const record = asRecord(obj);
  if (!record) return undefined;
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  }
  for (const value of Object.values(record)) {
    const found = findNamedUrl(value, names, depth + 1);
    if (found) return found;
  }
  return undefined;
}

async function pollTask(
  getUrl: string,
  apiKey: string,
  extractUrl: (json: unknown) => string | undefined,
  // 20 minutes. This runs in the media worker, not an HTTP request, so a long
  // wait costs nothing — and 7.5 minutes was demonstrably too short: real
  // Seedance/Kling video jobs timed out here while still running fine on
  // AnyFast's side, which surfaced to the user as a failure for no reason.
  { maxPolls = 240, intervalMs = 5000 } = {},
): Promise<{ url: string; raw: unknown }> {
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(getUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`AnyFast poll error: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const status = getTaskStatus(json);

    if (status === "SUCCESS" || status === "succeeded") {
      const url = extractUrl(json);
      if (!url) throw new Error("AnyFast task succeeded but no output URL was found in the response");
      return { url, raw: json };
    }
    if (status === "FAILED" || status === "failed") {
      throw new Error(`AnyFast task failed: ${getTaskFailReason(json)}`);
    }
  }
  throw new Error(
    `AnyFast task still wasn't finished after ${Math.round((maxPolls * intervalMs) / 60000)} minutes, so we stopped waiting. The job may still complete on AnyFast's side. Task: ${getUrl}`,
  );
}

async function downloadAsBuffer(url: string): Promise<{ data: Buffer; mimeType: string | null }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download AnyFast output: ${res.status}`);
  return { data: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get("content-type") };
}

function partitionRefs(refs: ReferenceInput[]): {
  images: ReferenceInput[];
  videos: ReferenceInput[];
  audios: ReferenceInput[];
} {
  const images: ReferenceInput[] = [];
  const videos: ReferenceInput[] = [];
  const audios: ReferenceInput[] = [];
  for (const ref of refs) {
    const mime = ref.mimeType.toLowerCase();
    if (mime.startsWith("video/")) videos.push(ref);
    else if (mime.startsWith("audio/")) audios.push(ref);
    else images.push(ref);
  }
  return { images, videos, audios };
}

type SeedanceContentItem = Record<string, unknown>;

/**
 * Builds Seedance `content[]` in documented order: text, then images, videos,
 * audio. `imageMode` picks first/last-frame vs multimodal reference roles
 * (those modes are mutually exclusive per AnyFast docs).
 */
function buildSeedanceContent(input: GenerationInput): SeedanceContentItem[] {
  const settings = input.settings ?? {};
  const imageMode = typeof settings.imageMode === "string" ? settings.imageMode : "reference";
  const { images, videos, audios } = partitionRefs(input.references ?? []);
  const content: SeedanceContentItem[] = [];

  if (input.prompt?.trim()) {
    content.push({ type: "text", text: input.prompt.trim() });
  }

  if (imageMode === "first_frame" || imageMode === "first_last_frame") {
    if (!images[0]) throw new Error(`Seedance imageMode "${imageMode}" requires at least one image attachment`);
    content.push({ type: "image_url", image_url: { url: images[0].url }, role: "first_frame" });
    if (imageMode === "first_last_frame") {
      if (!images[1]) throw new Error('Seedance imageMode "first_last_frame" requires two image attachments');
      content.push({ type: "image_url", image_url: { url: images[1].url }, role: "last_frame" });
    }
  } else {
    for (const image of images) {
      content.push({ type: "image_url", image_url: { url: image.url }, role: "reference_image" });
    }
  }

  for (const video of videos) {
    content.push({ type: "video_url", video_url: { url: video.url }, role: "reference_video" });
  }
  for (const audio of audios) {
    content.push({ type: "audio_url", audio_url: { url: audio.url }, role: "reference_audio" });
  }

  if (content.length === 0) {
    throw new Error("Seedance requires a text prompt or at least one media reference");
  }

  // Seedance 2.0 OpenAPI: audio must be paired with image or video. 2.5 allows audio-only.
  if (!SEEDANCE_2_5_MODELS.has(input.modelId) && audios.length > 0 && images.length === 0 && videos.length === 0) {
    throw new Error("Seedance 2.0 requires an image or video reference when attaching audio");
  }

  return content;
}

export async function seedanceAdapter(input: GenerationInput): Promise<GenerationResult> {
  const apiKey = requireApiKey();
  if (!SEEDANCE_MODELS.has(input.modelId)) {
    throw new Error(`Unsupported Seedance model id: ${input.modelId}`);
  }
  const settings = input.settings ?? {};
  const is25 = SEEDANCE_2_5_MODELS.has(input.modelId);
  const defaultResolution = is25 ? "1080p" : "720p";
  const content = buildSeedanceContent(input);

  const body: Record<string, unknown> = {
    model: input.modelId,
    content,
    generate_audio: settings.generateAudio ?? true,
    resolution: settings.resolution ?? defaultResolution,
    ratio: settings.ratio ?? "16:9",
    duration: settings.duration ?? 5,
    watermark: settings.watermark ?? false,
    return_last_frame: settings.returnLastFrame ?? false,
  };

  if (is25 && typeof settings.outputFormat === "string") {
    body.output_format = settings.outputFormat;
  }
  if (settings.webSearch === true) {
    body.tools = [{ type: "web_search" }];
  }
  if (typeof settings.seed === "number" && settings.seed >= 0) {
    body.seed = settings.seed;
  }
  if (is25 && typeof settings.omniReferenceTaskType === "string" && settings.omniReferenceTaskType !== "auto") {
    body.omni_reference_task_type = settings.omniReferenceTaskType;
  }

  const startRes = await fetch(`${ANYFAST_BASE}/v1/video/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!startRes.ok) throw new Error(`Seedance start error: ${startRes.status} ${await startRes.text()}`);
  const { task_id } = (await startRes.json()) as { task_id: string };

  const { url: videoUrl, raw } = await pollTask(
    `${ANYFAST_BASE}/v1/video/generations/${task_id}`,
    apiKey,
    (json) => {
      const data = asRecord(asRecord(json)?.data);
      if (typeof data?.result_url === "string") return data.result_url;
      return findNamedUrl(json, ["result_url", "video_url"]);
    },
  );

  const { data, mimeType } = await downloadAsBuffer(videoUrl);
  const outputs: GenerationResult["outputs"] = [
    { type: "video", mimeType: mimeType?.includes("video") ? mimeType : "video/mp4", data },
  ];

  if (settings.returnLastFrame === true) {
    const lastFrameUrl =
      findNamedUrl(raw, ["last_frame_url", "last_frame", "return_last_frame"]) ??
      findOutputUrl(raw, ["last_frames", "images"]);
    if (lastFrameUrl && lastFrameUrl !== videoUrl) {
      const frame = await downloadAsBuffer(lastFrameUrl);
      outputs.push({
        type: "image",
        mimeType: frame.mimeType?.includes("image") ? frame.mimeType : "image/png",
        data: frame.data,
      });
    }
  }

  return { outputs };
}

export async function seedreamAdapter(input: GenerationInput): Promise<GenerationResult> {
  const apiKey = requireApiKey();
  if (!input.prompt?.trim()) throw new Error("Seedream requires a text prompt");
  const settings = input.settings ?? {};
  const { images } = partitionRefs(input.references ?? []);

  const body: Record<string, unknown> = {
    model: "doubao-seedream-5-0-pro-260628",
    prompt: input.prompt.trim(),
    size: settings.size ?? "2K",
    output_format: settings.outputFormat ?? "png",
    response_format: "url",
    watermark: settings.watermark ?? false,
  };

  if (images.length === 1) body.image = images[0]!.url;
  else if (images.length > 1) body.image = images.map((i) => i.url);

  if (typeof settings.seed === "number" && settings.seed >= 0) {
    body.seed = settings.seed;
  }
  if (typeof settings.optimizePromptMode === "string") {
    body.optimize_prompt_options = { mode: settings.optimizePromptMode };
  }
  if (settings.layerDecomposition === true) {
    body.layer_decomposition = true;
    if (images.length !== 1) {
      throw new Error("Seedream layer decomposition requires exactly one reference image");
    }
  }
  if (typeof settings.background === "string" && settings.background !== "opaque") {
    body.background = settings.background;
    if (settings.background === "transparent") {
      if (images.length !== 1) {
        throw new Error("Seedream transparent background requires exactly one reference image");
      }
      body.output_format = "png";
    }
  }

  const res = await fetch(`${ANYFAST_BASE}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Seedream error: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: { url?: string; output_format?: string }[] };
  const items = (json.data ?? []).filter((d) => typeof d.url === "string");
  if (items.length === 0) throw new Error("Seedream returned no image URL");

  const outputs: GenerationResult["outputs"] = [];
  for (const item of items) {
    const { data, mimeType } = await downloadAsBuffer(item.url!);
    const fallback = item.output_format === "jpeg" ? "image/jpeg" : "image/png";
    outputs.push({
      type: "image",
      mimeType: mimeType?.includes("image") ? mimeType : fallback,
      data,
    });
  }
  return { outputs };
}

export async function klingOmniAdapter(input: GenerationInput): Promise<GenerationResult> {
  const apiKey = requireApiKey();
  if (!input.prompt?.trim()) throw new Error("Kling requires a text prompt");
  const settings = input.settings ?? {};
  const { images, videos, audios } = partitionRefs(input.references ?? []);
  if (audios.length > 0) {
    throw new Error("Kling 3.0 Omni does not accept audio reference inputs");
  }

  const imageMode = typeof settings.imageMode === "string" ? settings.imageMode : "reference";
  const body: Record<string, unknown> = {
    model_name: "kling-3.0-omni",
    prompt: input.prompt.trim(),
    duration: String(settings.duration ?? "5"),
    mode: settings.mode ?? "pro",
    aspect_ratio: settings.aspectRatio ?? "16:9",
  };

  if (images.length > 0) {
    body.image_list = images.map((image, index) => {
      const item: Record<string, unknown> = { image_url: image.url };
      if (imageMode === "first_frame" && index === 0) item.type = "first_frame";
      if (imageMode === "first_last_frame") {
        if (index === 0) item.type = "first_frame";
        if (index === 1) item.type = "end_frame";
      }
      return item;
    });
    if (imageMode === "first_frame" && images.length < 1) {
      throw new Error('Kling imageMode "first_frame" requires an image attachment');
    }
    if (imageMode === "first_last_frame" && images.length < 2) {
      throw new Error('Kling imageMode "first_last_frame" requires two image attachments');
    }
  }

  if (videos.length > 0) {
    // Kling accepts at most one reference video.
    body.video_list = [
      {
        video_url: videos[0]!.url,
        refer_type: settings.referType === "base" ? "base" : "feature",
        keep_original_sound: settings.keepOriginalSound === true || settings.keepOriginalSound === "yes" ? "yes" : "no",
      },
    ];
    // Docs: sound must be off when a reference video is present.
    body.sound = "off";
  } else {
    body.sound = settings.sound === "on" || settings.sound === true ? "on" : "off";
  }

  if (settings.multiShot === true) {
    body.multi_shot = true;
    // Customized storyboards need multi_prompt[]; expose intelligence mode only.
    body.shot_type = "intelligence";
  }

  if (settings.watermark === true) {
    body.watermark_info = { enabled: true };
  }

  const startRes = await fetch(`${ANYFAST_BASE}/kling/v1/videos/omni-video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!startRes.ok) throw new Error(`Kling start error: ${startRes.status} ${await startRes.text()}`);
  const { task_id } = (await startRes.json()) as { task_id: string };

  const { url: videoUrl } = await pollTask(`${ANYFAST_BASE}/kling/v1/videos/omni-video/${task_id}`, apiKey, (json) =>
    findOutputUrl(json, ["videos"]),
  );

  const { data, mimeType } = await downloadAsBuffer(videoUrl);
  return { outputs: [{ type: "video", mimeType: mimeType?.includes("video") ? mimeType : "video/mp4", data }] };
}
