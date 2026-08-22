"use server";

import { auth } from "@/lib/auth";

export interface ElevenLabsVoiceOption {
  voiceId: string;
  name: string;
  /** A real, publicly-hosted sample clip from ElevenLabs' own voices API — not something we generate. */
  previewUrl: string | null;
}

/** Real voices from the account's ElevenLabs voice library — never a hardcoded/guessed list. */
export async function listElevenLabsVoicesAction(): Promise<ElevenLabsVoiceOption[]> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { voices?: { voice_id: string; name: string; preview_url?: string | null }[] };
  return (data.voices ?? []).map((v) => ({ voiceId: v.voice_id, name: v.name, previewUrl: v.preview_url ?? null }));
}
