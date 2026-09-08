import type { GenerationAdapter } from "./types";
import { geminiImageAdapter, geminiOmni11FlashAdapter, geminiOmniFlashAdapter, geminiTtsAdapter, veoAdapter } from "./providers/google";
import { elevenLabsAdapter } from "./providers/elevenlabs";
import { klingOmniAdapter, seedanceAdapter, seedreamAdapter } from "./providers/anyfast";

const ADAPTERS: Record<string, GenerationAdapter> = {
  "gemini-3.1-flash-tts-preview": geminiTtsAdapter,
  eleven_multilingual_v2: elevenLabsAdapter,
  eleven_v3: elevenLabsAdapter,
  eleven_flash_v2_5: elevenLabsAdapter,
  "veo-3.1-generate-001": veoAdapter,
  "gemini-omni-flash-preview": geminiOmniFlashAdapter,
  "gemini-omni-1.1-flash-preview": geminiOmni11FlashAdapter,
  "gemini-3.1-flash-image": geminiImageAdapter,
  "seedance-2.5": seedanceAdapter,
  "kuaishou/kling-video-3.0-omni": klingOmniAdapter,
  "seedream-5.0-pro": seedreamAdapter,
};

export function getGenerationAdapter(modelId: string): GenerationAdapter {
  const adapter = ADAPTERS[modelId];
  if (!adapter) throw new Error(`No generation adapter registered for model "${modelId}"`);
  return adapter;
}
