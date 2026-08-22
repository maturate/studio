"use server";

import { getGenerationAdapter } from "@superos/workflow-engine";
import { auth } from "@/lib/auth";

const PREVIEW_TEXT = "This is a preview of the selected voice.";

// Google doesn't publish sample clips for its 30 prebuilt TTS voices the way
// ElevenLabs does — so previews are generated for real, on demand, via the
// same adapter a real run would use. Cached per voice (fixed preview text)
// so repeat clicks/users don't re-bill the same clip.
const cache = new Map<string, Promise<string>>();

/** Returns a data: URI for a short real speech sample in the given prebuilt voice. */
export async function previewGeminiVoiceAction(voiceName: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }

  const cached = cache.get(voiceName);
  if (cached) return cached;

  const promise = (async () => {
    const adapter = getGenerationAdapter("gemini-3.1-flash-tts-preview");
    const result = await adapter({
      modelId: "gemini-3.1-flash-tts-preview",
      prompt: PREVIEW_TEXT,
      settings: { voiceName },
    });
    const output = result.outputs[0];
    if (!output) throw new Error("No preview audio returned");
    return `data:${output.mimeType};base64,${output.data.toString("base64")}`;
  })();

  cache.set(voiceName, promise);
  promise.catch(() => cache.delete(voiceName));
  return promise;
}
