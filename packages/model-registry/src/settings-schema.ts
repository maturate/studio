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
  "seedance-2.5": [
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
        { value: "720p", label: "720p" },
        { value: "1080p", label: "1080p" },
      ],
      default: "1080p",
    },
    { key: "duration", label: "Duration (seconds)", type: "number", min: 4, max: 30, default: 5, hint: "4-30, or set to -1 for automatic." },
    { key: "generateAudio", label: "Generate audio", type: "boolean", default: true },
  ],
  "kuaishou/kling-video-3.0-omni": [
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
  ],
  "seedream-5.0-pro": [
    {
      key: "size",
      label: "Size",
      type: "select",
      options: [
        { value: "1K", label: "1K" },
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
