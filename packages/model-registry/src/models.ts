import type { DataType } from "@superos/shared";

export type ModelCategory = "image" | "audio" | "video";

export type PricingUnit =
  | "per_generation"
  | "per_second"
  | "per_character"
  | "per_1k_characters";

/**
 * Cost is intentionally nullable. We do not fabricate provider pricing —
 * `estimatedUsd` stays null (and `verified: false`) until real pricing is
 * confirmed and wired in, so the cost estimator can show "unknown" instead
 * of a made-up number.
 */
export interface ModelPricing {
  unit: PricingUnit;
  /** Default/fallback per-unit price, used when `perOption` doesn't apply or the setting is unset. */
  estimatedUsd: number | null;
  verified: boolean;
  notes?: string;
  /** Price varies by a settings field (e.g. output resolution) — keyed by that field's value. */
  perOption?: { settingKey: string; values: Record<string, number> };
  /**
   * Escape hatch for pricing that's a real formula rather than a flat/tiered
   * per-unit rate (e.g. token count derived from resolution × duration).
   * Takes priority over `unit`/`estimatedUsd`/`perOption` when present.
   * Returns the total USD for one generation at the given settings, or
   * `null` if it can't be computed (e.g. an unrecognized setting value) —
   * never fabricate a number by guessing.
   */
  computeUsd?: (input: { settings?: Record<string, unknown>; seconds?: number; characters?: number }) => number | null;
}

export interface ModelDefinition {
  /** Normalized id — stable, used in run records and node config. */
  id: string;
  provider: string;
  label: string;
  category: ModelCategory;
  /** What this model can produce. */
  outputTypes: DataType[];
  /** What input types this model accepts, beyond a text prompt. */
  inputTypes: DataType[];
  pricing: ModelPricing;
  status: "active" | "deprecated";
}

/**
 * Initial model/tooling registry — intentionally narrow.
 *
 * This list must stay limited to the production-approved tools named in
 * `superOS/Docs/marketing/production.md`, normalized in AGENTS.md section
 * 5.3A. Do not add a broader "all models" catalog here — expanding this
 * list requires explicit owner sign-off (see AGENTS.md hard rule 9).
 */
export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: "gemini-3.1-flash-tts-preview",
    provider: "google",
    label: "Gemini 3.1 Flash TTS Preview",
    category: "audio",
    outputTypes: ["audio"],
    inputTypes: ["text"],
    pricing: {
      unit: "per_second",
      estimatedUsd: 0.0005,
      verified: true,
      notes:
        "$20.00/1M output audio tokens, and Google states audio output is 25 tokens/sec — $20 × 25 / 1,000,000 = $0.0005/sec of generated speech. Input text is billed separately at $1.00/1M input tokens but is negligible for typical prompts and isn't counted here (no token counter). Sourced from ai.google.dev/gemini-api/docs/pricing.",
    },
    status: "active",
  },
  {
    id: "eleven_multilingual_v2",
    provider: "elevenlabs",
    label: "ElevenLabs Multilingual v2",
    category: "audio",
    outputTypes: ["audio"],
    inputTypes: ["text"],
    pricing: {
      unit: "per_1k_characters",
      estimatedUsd: 0.1,
      verified: true,
      notes: "$0.10/1k characters — ElevenLabs pay-as-you-go rate for eleven_multilingual_v2, confirmed at elevenlabs.io/pricing/api.",
    },
    status: "active",
  },
  {
    id: "eleven_v3",
    provider: "elevenlabs",
    label: "ElevenLabs v3",
    category: "audio",
    outputTypes: ["audio"],
    inputTypes: ["text"],
    pricing: {
      unit: "per_1k_characters",
      estimatedUsd: 0.1,
      verified: true,
      notes: "$0.10/1k characters — same pay-as-you-go rate as eleven_multilingual_v2, confirmed at elevenlabs.io/pricing/api.",
    },
    status: "active",
  },
  {
    id: "eleven_flash_v2_5",
    provider: "elevenlabs",
    label: "ElevenLabs Flash v2.5",
    category: "audio",
    outputTypes: ["audio"],
    inputTypes: ["text"],
    pricing: {
      unit: "per_1k_characters",
      estimatedUsd: 0.05,
      verified: true,
      notes: "$0.05/1k characters — 50% below the v2/v3 rate, confirmed at elevenlabs.io/pricing/api.",
    },
    status: "active",
  },
  {
    id: "veo-3.1-generate-001",
    provider: "google",
    label: "Veo 3.1",
    category: "video",
    outputTypes: ["video"],
    inputTypes: ["text", "image"],
    pricing: {
      unit: "per_second",
      estimatedUsd: 0.4,
      verified: true,
      notes:
        "$0.40/sec — Gemini Developer API standard tier, 720p-1080p (fast tier is $0.10-0.12/sec, 4K is $0.60/sec). Sourced from ai.google.dev/gemini-api/docs/pricing; Vertex AI billing for this integration typically mirrors Developer API rates for the same model but wasn't independently confirmed. Model id is veo-3.1-generate-001 (GA), only available at Vertex location us-central1, not global.",
    },
    status: "active",
  },
  {
    id: "gemini-omni-flash-preview",
    provider: "google",
    label: "Gemini Omni Flash Preview",
    category: "video",
    outputTypes: ["video"],
    inputTypes: ["text", "image", "reference", "character"],
    pricing: {
      unit: "per_second",
      estimatedUsd: 0.1,
      verified: true,
      notes:
        "~$0.10/sec for video output (720p) — Google bills this model per-token ($1.50/1M input tokens; $9.00/1M text output; $17.50/1M video output, where 720p video is ~5,792 tokens/sec). Sourced from ai.google.dev/gemini-api/docs/pricing#gemini-omni-flash-preview; Vertex AI billing for this integration typically mirrors Developer API rates for the same model but wasn't independently confirmed.",
    },
    status: "active",
  },
  {
    id: "gemini-omni-1.1-flash-preview",
    provider: "google",
    label: "Gemini Omni 1.1 Flash Preview",
    category: "video",
    outputTypes: ["video"],
    inputTypes: ["text", "image", "video", "reference", "character"],
    pricing: {
      unit: "per_second",
      estimatedUsd: null,
      verified: false,
      notes:
        "No published pricing found for this preview model yet — do not guess a number. Requires a project-level access grant beyond standard IAM/Owner (returns 403 on Vertex's generateContent and Interactions endpoints until Google enables it for the project); confirm billing once pricing is published.",
    },
    status: "active",
  },
  {
    id: "gemini-3.1-flash-image",
    provider: "google",
    label: "Gemini 3.1 Flash Image",
    category: "image",
    outputTypes: ["image"],
    inputTypes: ["text", "image", "reference", "character"],
    pricing: {
      unit: "per_generation",
      estimatedUsd: 0.067,
      verified: true,
      perOption: { settingKey: "imageSize", values: { "1K": 0.067, "2K": 0.101, "4K": 0.151 } },
      notes:
        "Gemini Developer API standard tier, by output resolution: $0.045/image (0.5K, not exposed in this UI), $0.067/image (1K), $0.101/image (2K), $0.151/image (4K). Batch tier is ~50% cheaper across the board but not used here. Sourced from ai.google.dev/gemini-api/docs/pricing; Vertex AI billing for this integration typically mirrors Developer API rates for the same model but wasn't independently confirmed.",
    },
    status: "active",
  },
  {
    id: "seedance-2.5",
    provider: "bytedance",
    label: "Seedance 2.5",
    category: "video",
    outputTypes: ["video"],
    inputTypes: ["text", "image", "video", "audio", "frames", "reference", "character"],
    pricing: {
      unit: "per_second",
      estimatedUsd: null,
      verified: false,
      computeUsd: (input) => {
        const settings = input.settings ?? {};
        const resolution = settings.resolution === "1080p" ? "1080p" : "720p";
        const rawDuration = Number(settings.duration);
        const duration = rawDuration > 0 ? rawDuration : 5; // schema default; "-1" (automatic) can't be sized ahead of generation
        // 16:9 dimensions assumed — Seedance's own token formula scales with total pixel count,
        // so other supported aspect ratios (9:16, 1:1, 21:9, etc.) will be under/overestimated by this.
        const [width, height] = resolution === "1080p" ? [1920, 1080] : [1280, 720];
        // tokens = (height × width × duration × 24) / 1024 — ByteDance/Volcano Engine's own published
        // formula, cross-checked against their stated example (5s 720p = ¥7.56 at ¥70/M tokens): matches exactly.
        const tokens = (height * width * duration * 24) / 1024;
        // AnyFast's confirmed no-input-video rate (cheaper "with input video" tier not applied — we
        // don't know at estimate time whether a reference will be attached).
        const ratePerMillionUsd = resolution === "1080p" ? 11.7 : 10.7;
        return (tokens / 1_000_000) * ratePerMillionUsd;
      },
      notes:
        "Computed from Volcano Engine's own token formula — tokens = (height × width × duration × 24) / 1024, assuming 16:9 — at AnyFast's confirmed no-input-video rate: $10.70/M tokens (720p), $11.70/M tokens (1080p). With-video-input is cheaper ($6.40/M and $7.00/M respectively) but isn't applied since the estimator doesn't know ahead of time whether a reference will be attached. Non-16:9 aspect ratios will be under/overestimated since pixel count varies by ratio.",
    },
    status: "active",
  },
  {
    id: "seedance-2.5-nsfw",
    provider: "bytedance",
    label: "Seedance 2.5 NSFW",
    category: "video",
    outputTypes: ["video"],
    inputTypes: ["text", "image", "video", "audio", "frames", "reference", "character"],
    pricing: {
      unit: "per_second",
      estimatedUsd: null,
      verified: false,
      computeUsd: (input) => {
        const settings = input.settings ?? {};
        const resolution = settings.resolution === "1080p" ? "1080p" : "720p";
        const rawDuration = Number(settings.duration);
        const duration = rawDuration > 0 ? rawDuration : 5;
        const [width, height] = resolution === "1080p" ? [1920, 1080] : [1280, 720];
        const tokens = (height * width * duration * 24) / 1024;
        // Same formula as seedance-2.5; NSFW Direct-group rates not independently confirmed.
        const ratePerMillionUsd = resolution === "1080p" ? 11.7 : 10.7;
        return (tokens / 1_000_000) * ratePerMillionUsd;
      },
      notes:
        "Same Volcano Engine token formula as Seedance 2.5 (16:9 assumed). NSFW Direct-group pricing not independently confirmed — treat estimates as approximate. Live-verified: model id accepted by AnyFast (/v1/models + start returns insufficient_user_quota, not model_not_found).",
    },
    status: "active",
  },
  {
    id: "seedance-2.0-nsfw",
    provider: "bytedance",
    label: "Seedance 2.0 NSFW",
    category: "video",
    outputTypes: ["video"],
    inputTypes: ["text", "image", "video", "audio", "frames", "reference", "character"],
    pricing: {
      unit: "per_second",
      estimatedUsd: null,
      verified: false,
      notes:
        "AnyFast Direct-group NSFW variant of Seedance 2.0. Pricing not confirmed — leave estimate unset. Live-verified: POST /v1/video/generations returned 200 with task_id and task progressed to IN_PROGRESS.",
    },
    status: "active",
  },
  {
    id: "kuaishou/kling-video-3.0-omni",
    provider: "kuaishou",
    label: "Kling Video 3.0 Omni",
    category: "video",
    outputTypes: ["video"],
    inputTypes: ["text", "image", "video", "frames", "reference", "character"],
    pricing: {
      unit: "per_second",
      estimatedUsd: 0.112,
      verified: true,
      perOption: { settingKey: "mode", values: { std: 0.084, pro: 0.112, "4k": 0.42 } },
      notes:
        "By mode, no video input / no native audio tier (this node doesn't expose those toggles): std/720p $0.084/s, pro/1080p $0.112/s, 4K $0.420/s flat. Full AnyFast tier table (for reference, not wired in): 720p $0.084/s (no audio) / $0.112/s (native audio) / $0.126/s (with input video); 1080p $0.112/s / $0.140/s / $0.168/s; 4K flat $0.420/s regardless of audio/input-video.",
    },
    status: "active",
  },
  {
    id: "seedream-5.0-pro",
    provider: "bytedance",
    label: "Seedream 5.0 Pro",
    category: "image",
    outputTypes: ["image"],
    inputTypes: ["text", "image", "reference", "character"],
    pricing: {
      unit: "per_generation",
      estimatedUsd: 0.09,
      verified: true,
      perOption: { settingKey: "size", values: { "1K": 0.045, "2K": 0.09 } },
      notes: "$0.09/image at 2K (this node's default size). 1K is $0.045/image.",
    },
    status: "active",
  },
];

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getModelsByCategory(category: ModelCategory): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.category === category && m.status === "active");
}
