/**
 * Per-model advanced-settings field definitions, driving real typed
 * controls (selects/sliders/checkboxes) in both Playground and the
 * Workflow node editor — never a free JSON textarea. Field keys match
 * exactly what each provider adapter reads from `GenerationInput.settings`
 * (see packages/workflow-engine/src/generation/providers/*).
 *
 * `count` (variant/bulk output count) is deliberately NOT listed here — it's
 * universal across every generator model and rendered once by the shared
 * settings form, then stripped before the remaining settings are handed to
 * the adapter.
 */

export type SettingField =
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; default: string; hint?: string }
  /**
   * A voice picker with per-option audio preview (native `<select>` can't
   * hold a play button per row, so this renders a custom listbox).
   * "elevenlabs": options fetched live from the account's voice library,
   * each with a real preview clip from ElevenLabs' own API. "gemini-tts":
   * a fixed list of prebuilt voice names (Google publishes no sample clips
   * for these — previews are synthesized for real, on demand, and cached).
   */
  | { key: string; label: string; type: "voice-select"; source: "elevenlabs"; hint?: string }
  | { key: string; label: string; type: "voice-select"; source: "gemini-tts"; options: string[]; default: string; hint?: string }
  | { key: string; label: string; type: "number"; min: number; max: number; step?: number; default: number; hint?: string }
  | { key: string; label: string; type: "range"; min: number; max: number; step: number; default: number; hint?: string }
  | { key: string; label: string; type: "boolean"; default: boolean; hint?: string };

const GEMINI_TTS_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];

/**
 * Shared by both Gemini Omni models (same Interactions API, same
 * generation_config/response_format schema). Fields grounded in Google's
 * own SDK type definitions (video_config.task, response_format for video,
 * thinking_level, seed) — confirmed live for gemini-omni-1.1-flash-preview;
 * "auto"/0 sentinels below mean "don't send this field" so the model falls
 * back to its own default behavior.
 */
const OMNI_SETTINGS: SettingField[] = [
  {
    key: "task",
    label: "Task",
    type: "select",
    options: [
      { value: "auto", label: "Auto (let the model infer from prompt/inputs)" },
      { value: "text_to_video", label: "Text to video" },
      { value: "image_to_video", label: "Image to video" },
      { value: "reference_to_video", label: "Reference to video" },
      { value: "edit", label: "Edit (existing video input)" },
      { value: "extend", label: "Extend (existing video input)" },
    ],
    default: "auto",
  },
  {
    key: "aspectRatio",
    label: "Aspect ratio",
    type: "select",
    options: [
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
    default: "16:9",
  },
  {
    key: "resolution",
    label: "Resolution",
    type: "select",
    options: [
      { value: "360p", label: "360p" },
      { value: "720p", label: "720p" },
      { value: "1080p", label: "1080p" },
      { value: "4k", label: "4K" },
    ],
    default: "720p",
  },
  {
    key: "durationSeconds",
    label: "Duration (seconds)",
    type: "number",
    min: 2,
    max: 10,
    default: 8,
    hint: "Max is 10 — the API rejects anything longer (\"Generation duration 12 exceeds maximum duration 10\", confirmed live).",
  },
  {
    key: "thinkingLevel",
    label: "Thinking level",
    type: "select",
    options: [
      { value: "low", label: "Low" },
      { value: "high", label: "High" },
    ],
    default: "low",
    hint: "How much internal reasoning the model does before generating. \"medium\"/\"minimal\" exist in Google's general schema but this model rejects them (\"not a supported thinking level for this model\", confirmed live) — only low/high work here.",
  },
  {
    key: "seed",
    label: "Seed",
    type: "number",
    min: 0,
    max: 2147483647,
    default: 0,
    hint: "0 = random/no fixed seed. Set a fixed value for reproducible output.",
  },
];

const SEEDANCE_IMAGE_MODE: SettingField = {
  key: "imageMode",
  label: "Image role",
  type: "select",
  options: [
    { value: "reference", label: "Reference images (@imageN)" },
    { value: "first_frame", label: "First frame" },
    { value: "first_last_frame", label: "First + last frame" },
  ],
  default: "reference",
  hint: "First/last-frame modes are mutually exclusive with multimodal reference images.",
};

const SEEDANCE_2_5_SETTINGS: SettingField[] = [
  SEEDANCE_IMAGE_MODE,
  {
    key: "omniReferenceTaskType",
    label: "Reference task",
    type: "select",
    options: [
      { value: "auto", label: "Auto" },
      { value: "reference", label: "Reference" },
      { value: "edit", label: "Edit (needs video + adaptive/-1)" },
      { value: "extend", label: "Extend (needs video + adaptive)" },
    ],
    default: "auto",
  },
  {
    key: "ratio",
    label: "Aspect ratio",
    type: "select",
    options: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "adaptive"].map((v) => ({ value: v, label: v })),
    default: "16:9",
  },
  {
    key: "resolution",
    label: "Resolution",
    type: "select",
    options: [
      { value: "480p", label: "480p" },
      { value: "720p", label: "720p" },
      { value: "1080p", label: "1080p" },
    ],
    default: "1080p",
  },
  { key: "duration", label: "Duration (seconds)", type: "number", min: -1, max: 30, default: 5, hint: "4–30, or -1 for automatic." },
  {
    key: "outputFormat",
    label: "Container",
    type: "select",
    options: [
      { value: "mp4", label: "MP4" },
      { value: "mov", label: "MOV" },
    ],
    default: "mp4",
  },
  { key: "generateAudio", label: "Generate audio", type: "boolean", default: true },
  { key: "webSearch", label: "Web search (text-to-video)", type: "boolean", default: false },
  { key: "returnLastFrame", label: "Return last frame", type: "boolean", default: false },
  { key: "watermark", label: "AI watermark", type: "boolean", default: false },
  { key: "seed", label: "Seed (-1 = random)", type: "number", min: -1, max: 2147483647, default: -1 },
];

const SEEDANCE_2_0_SETTINGS: SettingField[] = [
  SEEDANCE_IMAGE_MODE,
  {
    key: "ratio",
    label: "Aspect ratio",
    type: "select",
    options: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "adaptive"].map((v) => ({ value: v, label: v })),
    default: "16:9",
  },
  {
    key: "resolution",
    label: "Resolution",
    type: "select",
    options: [
      { value: "480p", label: "480p" },
      { value: "720p", label: "720p" },
      { value: "1080p", label: "1080p" },
      { value: "4k", label: "4K" },
    ],
    default: "720p",
  },
  { key: "duration", label: "Duration (seconds)", type: "number", min: 4, max: 15, default: 5, hint: "4–15 seconds." },
  { key: "generateAudio", label: "Generate audio", type: "boolean", default: true },
  { key: "webSearch", label: "Web search (text-to-video)", type: "boolean", default: false },
  { key: "returnLastFrame", label: "Return last frame", type: "boolean", default: false },
  { key: "watermark", label: "AI watermark", type: "boolean", default: false },
  { key: "seed", label: "Seed (-1 = random)", type: "number", min: -1, max: 2147483647, default: -1 },
];

export const SETTINGS_SCHEMA: Record<string, SettingField[]> = {
  "gemini-3.1-flash-tts-preview": [
    {
      key: "voiceName",
      label: "Voice",
      type: "voice-select",
      source: "gemini-tts",
      options: GEMINI_TTS_VOICES,
      default: "Kore",
    },
  ],
  eleven_multilingual_v2: [
    { key: "voiceId", label: "Voice", type: "voice-select", source: "elevenlabs" },
    { key: "stability", label: "Stability", type: "range", min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: "similarityBoost", label: "Similarity boost", type: "range", min: 0, max: 1, step: 0.05, default: 0.75 },
    { key: "style", label: "Style exaggeration", type: "range", min: 0, max: 1, step: 0.05, default: 0 },
    { key: "speed", label: "Speed", type: "range", min: 0.7, max: 1.2, step: 0.05, default: 1 },
    { key: "useSpeakerBoost", label: "Speaker boost", type: "boolean", default: true },
    {
      key: "outputFormat",
      label: "Output format",
      type: "select",
      options: [
        { value: "mp3_44100_128", label: "MP3 44.1kHz 128kbps (default)" },
        { value: "mp3_44100_192", label: "MP3 44.1kHz 192kbps" },
        { value: "wav_44100", label: "WAV 44.1kHz" },
      ],
      default: "mp3_44100_128",
      hint: "ElevenLabs supports more formats/sample rates than listed here (e.g. Opus, μ-law) — these cover the common cases.",
    },
  ],
  eleven_v3: [
    { key: "voiceId", label: "Voice", type: "voice-select", source: "elevenlabs" },
    { key: "stability", label: "Stability", type: "range", min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: "similarityBoost", label: "Similarity boost", type: "range", min: 0, max: 1, step: 0.05, default: 0.75 },
    { key: "style", label: "Style exaggeration", type: "range", min: 0, max: 1, step: 0.05, default: 0 },
    { key: "speed", label: "Speed", type: "range", min: 0.7, max: 1.2, step: 0.05, default: 1 },
    { key: "useSpeakerBoost", label: "Speaker boost", type: "boolean", default: true },
    {
      key: "outputFormat",
      label: "Output format",
      type: "select",
      options: [
        { value: "mp3_44100_128", label: "MP3 44.1kHz 128kbps (default)" },
        { value: "mp3_44100_192", label: "MP3 44.1kHz 192kbps" },
        { value: "wav_44100", label: "WAV 44.1kHz" },
      ],
      default: "mp3_44100_128",
      hint: "ElevenLabs supports more formats/sample rates than listed here (e.g. Opus, μ-law) — these cover the common cases.",
    },
  ],
  eleven_flash_v2_5: [
    { key: "voiceId", label: "Voice", type: "voice-select", source: "elevenlabs" },
    { key: "stability", label: "Stability", type: "range", min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: "similarityBoost", label: "Similarity boost", type: "range", min: 0, max: 1, step: 0.05, default: 0.75 },
    { key: "style", label: "Style exaggeration", type: "range", min: 0, max: 1, step: 0.05, default: 0 },
    { key: "speed", label: "Speed", type: "range", min: 0.7, max: 1.2, step: 0.05, default: 1 },
    { key: "useSpeakerBoost", label: "Speaker boost", type: "boolean", default: true },
    {
      key: "outputFormat",
      label: "Output format",
      type: "select",
      options: [
        { value: "mp3_44100_128", label: "MP3 44.1kHz 128kbps (default)" },
        { value: "mp3_44100_192", label: "MP3 44.1kHz 192kbps" },
        { value: "wav_44100", label: "WAV 44.1kHz" },
      ],
      default: "mp3_44100_128",
      hint: "ElevenLabs supports more formats/sample rates than listed here (e.g. Opus, μ-law) — these cover the common cases.",
    },
  ],
  "veo-3.1-generate-001": [
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      options: [
        { value: "16:9", label: "16:9" },
        { value: "9:16", label: "9:16" },
      ],
      default: "16:9",
    },
    {
      key: "durationSeconds",
      label: "Duration",
      type: "select",
      options: [
        { value: "4", label: "4s" },
        { value: "6", label: "6s" },
        { value: "8", label: "8s" },
      ],
      default: "8",
    },
    {
      key: "resolution",
      label: "Resolution",
      type: "select",
      options: [
        { value: "720p", label: "720p" },
        { value: "1080p", label: "1080p" },
        { value: "4k", label: "4K" },
      ],
      default: "720p",
      hint: "1080p/4K only support 8s duration.",
    },
    {
      key: "personGeneration",
      label: "People",
      type: "select",
      options: [
        { value: "allow_all", label: "Allow all" },
        { value: "allow_adult", label: "Adults only" },
      ],
      default: "allow_all",
    },
  ],
  "gemini-3.1-flash-image": [
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      options: [
        "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
      ].map((v) => ({ value: v, label: v })),
      default: "1:1",
    },
    {
      key: "imageSize",
      label: "Size",
      type: "select",
      options: [
        { value: "1K", label: "1K" },
        { value: "2K", label: "2K" },
        { value: "4K", label: "4K" },
      ],
      default: "1K",
    },
  ],
  // AnyFast Seedance 2.5 (+ NSFW) — confirmed against docs.anyfast.ai Seedance 2.5 guide.
  "seedance-2.5": SEEDANCE_2_5_SETTINGS,
  "seedance-2.5-nsfw": SEEDANCE_2_5_SETTINGS,
  // AnyFast Seedance 2.0 NSFW — duration 4–15, resolution up to 4k (no output_format / omni task type).
  "seedance-2.0-nsfw": SEEDANCE_2_0_SETTINGS,
  "kuaishou/kling-video-3.0-omni": [
    {
      key: "imageMode",
      label: "Image role",
      type: "select",
      options: [
        { value: "reference", label: "Reference images (<<<image_n>>>)" },
        { value: "first_frame", label: "First frame" },
        { value: "first_last_frame", label: "First + end frame" },
      ],
      default: "reference",
    },
    {
      key: "referType",
      label: "Video reference type",
      type: "select",
      options: [
        { value: "feature", label: "Feature (style/motion reference)" },
        { value: "base", label: "Base (edit the input video)" },
      ],
      default: "feature",
      hint: "Only used when a video attachment is present. Sound is forced off with video refs.",
    },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: [
        { value: "std", label: "Standard (720p)" },
        { value: "pro", label: "Pro (1080p)" },
        { value: "4k", label: "4K" },
      ],
      default: "pro",
    },
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      options: [
        { value: "16:9", label: "16:9" },
        { value: "9:16", label: "9:16" },
        { value: "1:1", label: "1:1" },
      ],
      default: "16:9",
    },
    { key: "duration", label: "Duration (seconds)", type: "number", min: 3, max: 15, default: 5 },
    {
      key: "sound",
      label: "Generate sound",
      type: "select",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
      ],
      default: "off",
      hint: "Ignored (forced off) when a reference video is attached.",
    },
    { key: "keepOriginalSound", label: "Keep original video sound", type: "boolean", default: false },
    {
      key: "multiShot",
      label: "Intelligent multi-shot",
      type: "boolean",
      default: false,
      hint: "Uses Kling intelligence storyboard mode from the prompt (custom shot lists not exposed yet).",
    },
    { key: "watermark", label: "AI watermark", type: "boolean", default: false },
  ],
  "gemini-omni-flash-preview": OMNI_SETTINGS,
  "gemini-omni-1.1-flash-preview": OMNI_SETTINGS,
  "seedream-5.0-pro": [
    {
      key: "size",
      label: "Size",
      type: "select",
      options: [
        { value: "1K", label: "1K" },
        { value: "1.5K", label: "1.5K" },
        { value: "2K", label: "2K" },
      ],
      default: "2K",
    },
    {
      key: "outputFormat",
      label: "Format",
      type: "select",
      options: [
        { value: "png", label: "PNG" },
        { value: "jpeg", label: "JPEG" },
      ],
      default: "png",
    },
    {
      key: "optimizePromptMode",
      label: "Prompt optimize",
      type: "select",
      options: [
        { value: "standard", label: "Standard (quality)" },
        { value: "fast", label: "Fast (latency)" },
      ],
      default: "standard",
    },
    {
      key: "background",
      label: "Background",
      type: "select",
      options: [
        { value: "opaque", label: "Opaque" },
        { value: "transparent", label: "Transparent (single PNG ref)" },
      ],
      default: "opaque",
    },
    {
      key: "layerDecomposition",
      label: "Layer decomposition",
      type: "boolean",
      default: false,
      hint: "Splits one reference image into a background + editable PNG layers.",
    },
    { key: "seed", label: "Seed (-1 = random)", type: "number", min: -1, max: 2147483647, default: -1 },
    { key: "watermark", label: "AI watermark", type: "boolean", default: false },
  ],
};

export function getSettingsSchema(modelId: string): SettingField[] {
  return SETTINGS_SCHEMA[modelId] ?? [];
}

export function defaultSettingsFor(modelId: string): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of getSettingsSchema(modelId)) {
    if (field.type === "voice-select" && field.source === "elevenlabs") continue;
    defaults[field.key] = field.default;
  }
  return defaults;
}
