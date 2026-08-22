import type { GenerationInput, GenerationResult } from "../types";
import { getVertexAccessToken, getVertexProjectId, vertexModelUrl } from "./vertex-auth";

async function referenceToInlinePart(ref: { url: string; mimeType: string }) {
  const res = await fetch(ref.url);
  if (!res.ok) throw new Error(`Could not fetch reference asset: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { inlineData: { mimeType: ref.mimeType, data: buf.toString("base64") } };
}

/** Wraps raw 16-bit PCM (Gemini TTS output) in a minimal WAV header so it's playable. */
function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Shared `generateContent` caller for Gemini-family models (image, TTS, and
 * Omni Flash), against Vertex AI's publisher-model endpoint. The
 * request/response body shape (`contents`/`generationConfig`, inline data
 * parts) is the same Gemini contract as the public Generative Language API —
 * only the host, path, and auth (OAuth2 service account vs. API key) differ.
 */
async function callGenerateContent(
  model: string,
  input: GenerationInput,
  modalities: string[],
  extraConfig?: Record<string, unknown>,
) {
  const token = await getVertexAccessToken();
  const parts: unknown[] = [];
  if (input.prompt) parts.push({ text: input.prompt });
  for (const ref of input.references ?? []) {
    parts.push(await referenceToInlinePart(ref));
  }

  const res = await fetch(vertexModelUrl(model, "generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: modalities, ...(extraConfig ?? input.settings ?? {}) },
    }),
  });

  if (!res.ok) {
    throw new Error(`Vertex AI error (${model}): ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] };
      finishReason?: string;
      finishMessage?: string;
    }[];
  };

  const inlineParts =
    json.candidates?.[0]?.content?.parts?.filter((p) => p.inlineData) ?? [];
  if (inlineParts.length === 0) {
    const { finishReason, finishMessage } = json.candidates?.[0] ?? {};
    throw new Error(
      finishReason
        ? `Vertex AI (${model}) declined to generate: ${finishReason}${finishMessage ? ` — ${finishMessage}` : ""}`
        : `Vertex AI (${model}) returned no media output`,
    );
  }

  return { inlineParts, raw: json };
}

/**
 * Plain text generation (no media) — used by transform/context nodes, not
 * the media adapter registry. `gemini-omni-flash-preview` cannot be called
 * via generateContent at all (confirmed: Vertex rejects it outright, see
 * `geminiOmniFlashAdapter` below) — this uses `gemini-2.5-flash`, a real
 * generateContent-capable text model, confirmed live against this project.
 */
export async function geminiGenerateText(prompt: string, model: string = "gemini-2.5-flash"): Promise<string> {
  const token = await getVertexAccessToken();
  const res = await fetch(vertexModelUrl(model, "generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Vertex AI text generation error: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Vertex AI text generation returned no text");
  return text;
}

/** Summary of an STT transcript at a target word count, via a real second Gemini call (gemini-3.5-flash-lite, confirmed live against this project). */
export async function geminiSummarizeTranscript(transcript: string, targetWords = 200): Promise<string> {
  return geminiGenerateText(
    `Summarize the following transcript in about ${targetWords} words, covering everything that happened:\n\n${transcript}`,
    "gemini-3.5-flash-lite",
  );
}

export async function geminiImageAdapter(input: GenerationInput): Promise<GenerationResult> {
  const { aspectRatio, imageSize } = input.settings ?? {};
  const { inlineParts, raw } = await callGenerateContent(
    "gemini-3.1-flash-image",
    input,
    ["IMAGE"],
    { imageConfig: { aspectRatio, imageSize } },
  );
  return {
    outputs: inlineParts.map((p) => ({
      type: "image",
      mimeType: p.inlineData!.mimeType,
      data: Buffer.from(p.inlineData!.data, "base64"),
    })),
    providerMetadata: { raw },
  };
}

export async function geminiTtsAdapter(input: GenerationInput): Promise<GenerationResult> {
  const voiceName = (input.settings?.voiceName as string | undefined) ?? "Kore";
  const { inlineParts, raw } = await callGenerateContent(
    "gemini-3.1-flash-tts-preview",
    input,
    ["AUDIO"],
    { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
  );
  return {
    outputs: inlineParts.map((p) => ({
      type: "audio",
      mimeType: "audio/wav",
      data: pcmToWav(Buffer.from(p.inlineData!.data, "base64")),
    })),
    providerMetadata: { raw },
  };
}

/**
 * Gemini Omni Flash is not callable via the classic `generateContent`
 * surface at all — Vertex rejects it outright ("only supported in the
 * Interactions API"). It lives on a separate endpoint
 * (`{location}/interactions`, `v1beta1`) with its own request/response
 * shape, confirmed by a live call: `input` is an array of typed parts
 * (`{type:"text", text}` confirmed; `{type:"image", data, mime_type}` for
 * image input is inferred from the output shape below and NOT independently
 * confirmed). The response is synchronous (`status:"completed"` directly,
 * no polling/operation), and the generated media lives in
 * `steps[].content[]` on whichever step has `type:"model_output"` — each
 * content item is `{data: <base64>, mime_type, type}`. Every documented use
 * case (text-to-video, image-to-video, reference-to-video, video editing)
 * produces video only; there is no image-output mode for this model.
 */
export async function geminiOmniFlashAdapter(input: GenerationInput): Promise<GenerationResult> {
  const project = getVertexProjectId();
  const token = await getVertexAccessToken();

  const parts: unknown[] = [];
  if (input.prompt) parts.push({ type: "text", text: input.prompt });
  for (const ref of input.references ?? []) {
    const res = await fetch(ref.url);
    if (!res.ok) throw new Error(`Could not fetch reference asset: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    parts.push({ type: "image", data: buf.toString("base64"), mime_type: ref.mimeType });
  }

  const res = await fetch(`https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/global/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: "gemini-omni-flash-preview", input: parts }),
  });
  if (!res.ok) {
    throw new Error(`Gemini Omni Flash error: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    status?: string;
    steps?: { type?: string; content?: { data?: string; mime_type?: string; type?: string }[] }[];
  };
  if (json.status !== "completed") {
    throw new Error(`Gemini Omni Flash returned status "${json.status}" (expected "completed")`);
  }

  const outputStep = json.steps?.find((s) => s.type === "model_output");
  const outputs = (outputStep?.content ?? [])
    .filter((c) => c.data && c.mime_type)
    .map((c) => ({
      type: "video" as const,
      mimeType: c.mime_type!,
      data: Buffer.from(c.data!, "base64"),
    }));

  if (outputs.length === 0) {
    throw new Error("Gemini Omni Flash returned no media output");
  }

  return { outputs, providerMetadata: { raw: json } };
}

/**
 * Veo on Vertex AI: publisher-model long-running operations use
 * `predictLongRunning` to start and `fetchPredictOperation` (a POST with
 * the operation name in the body) to poll — unlike a plain GET on the
 * operation resource. This is Vertex's documented pattern for publisher
 * model LROs. The exact shape of the completed response (inline base64 vs.
 * a GCS URI) isn't fully pinned down here since Veo-on-Vertex output mode
 * depends on request config we haven't tested live — this handles both:
 * inline `bytesBase64Encoded` is used directly, a `gcsUri` is downloaded
 * via an authenticated GET.
 */
export async function veoAdapter(input: GenerationInput): Promise<GenerationResult> {
  const model = "veo-3.1-generate-001";
  // Veo is not available at the "global" location the rest of these adapters use — it requires a real region.
  const VEO_LOCATION = "us-central1";
  const startToken = await getVertexAccessToken();

  const startRes = await fetch(vertexModelUrl(model, "predictLongRunning", VEO_LOCATION), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${startToken}` },
    body: JSON.stringify({
      instances: [{ prompt: input.prompt ?? "" }],
      parameters: input.settings ?? {},
    }),
  });
  if (!startRes.ok) {
    throw new Error(`Veo start error: ${startRes.status} ${await startRes.text()}`);
  }
  const { name: operationName } = (await startRes.json()) as { name: string };

  const POLL_INTERVAL_MS = 5000;
  const MAX_POLLS = 60; // ~5 minutes
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pollToken = await getVertexAccessToken();
    const pollRes = await fetch(vertexModelUrl(model, "fetchPredictOperation", VEO_LOCATION), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pollToken}` },
      body: JSON.stringify({ operationName }),
    });
    if (!pollRes.ok) throw new Error(`Veo poll error: ${pollRes.status} ${await pollRes.text()}`);
    const op = (await pollRes.json()) as {
      done?: boolean;
      error?: { message: string };
      response?: {
        videos?: { bytesBase64Encoded?: string; gcsUri?: string; mimeType?: string }[];
        predictions?: { bytesBase64Encoded?: string; gcsUri?: string; mimeType?: string }[];
      };
    };
    if (op.error) throw new Error(`Veo generation failed: ${op.error.message}`);
    if (op.done) {
      const samples = op.response?.videos ?? op.response?.predictions ?? [];
      if (samples.length === 0) throw new Error("Veo operation completed but returned no video samples");

      const outputs = await Promise.all(
        samples.map(async (s) => {
          if (s.bytesBase64Encoded) {
            return { type: "video" as const, mimeType: s.mimeType ?? "video/mp4", data: Buffer.from(s.bytesBase64Encoded, "base64") };
          }
          if (s.gcsUri) {
            const token = await getVertexAccessToken();
            const objectRes = await fetch(
              `https://storage.googleapis.com/storage/v1/b/${s.gcsUri.replace("gs://", "").split("/")[0]}/o/${encodeURIComponent(
                s.gcsUri.replace("gs://", "").split("/").slice(1).join("/"),
              )}?alt=media`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!objectRes.ok) throw new Error(`Veo GCS download error: ${objectRes.status}`);
            return { type: "video" as const, mimeType: s.mimeType ?? "video/mp4", data: Buffer.from(await objectRes.arrayBuffer()) };
          }
          throw new Error("Veo sample had neither bytesBase64Encoded nor gcsUri");
        }),
      );
      return { outputs, providerMetadata: { operationName } };
    }
  }
  throw new Error(`Veo generation timed out waiting on ${operationName}`);
}
