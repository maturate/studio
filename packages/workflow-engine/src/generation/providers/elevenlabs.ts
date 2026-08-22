import type { GenerationInput, GenerationResult } from "../types";
import { ProviderNotConfiguredError } from "../types";

export async function elevenLabsAdapter(input: GenerationInput): Promise<GenerationResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new ProviderNotConfiguredError("ELEVENLABS_API_KEY");

  const voiceId = input.settings?.voiceId as string | undefined;
  if (!voiceId) {
    throw new Error(
      "ElevenLabs requires settings.voiceId — a voice id from your ElevenLabs voice library.",
    );
  }
  if (!input.prompt) {
    throw new Error("ElevenLabs requires a text prompt to synthesize.");
  }

  const { stability, similarityBoost, style, speed, useSpeakerBoost, outputFormat } = input.settings ?? {};
  const format = (outputFormat as string | undefined) ?? "mp3_44100_128";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${encodeURIComponent(format)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: input.prompt,
        model_id: input.modelId,
        voice_settings: {
          stability: stability ?? 0.5,
          similarity_boost: similarityBoost ?? 0.75,
          style: style ?? 0,
          speed: speed ?? 1,
          use_speaker_boost: useSpeakerBoost ?? true,
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`ElevenLabs API error: ${res.status} ${await res.text()}`);
  }

  const data = Buffer.from(await res.arrayBuffer());
  const mimeType = format.startsWith("wav_") ? "audio/wav" : "audio/mpeg";
  return { outputs: [{ type: "audio", mimeType, data }] };
}

export interface TranscriptionResult {
  text: string;
  languageCode: string | null;
}

/**
 * ElevenLabs Scribe v2 speech-to-text. `sourceUrl` can be a YouTube/TikTok
 * URL or any other hosted audio/video URL — ElevenLabs fetches it directly,
 * confirmed via a live call (request reached real endpoint logic, not a
 * malformed-request error). Requires the API key to have the
 * `speech_to_text` permission enabled in the ElevenLabs dashboard.
 */
export async function elevenLabsTranscribe(sourceUrl: string): Promise<TranscriptionResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new ProviderNotConfiguredError("ELEVENLABS_API_KEY");

  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("source_url", sourceUrl);

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs transcription error: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { text?: string; language_code?: string };
  if (!json.text) throw new Error("ElevenLabs transcription returned no text");
  return { text: json.text, languageCode: json.language_code ?? null };
}
