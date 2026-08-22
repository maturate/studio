"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { confirmUploadAction, requestUploadUrlAction } from "@/features/assets/actions";
import { DropZone } from "@/components/drop-zone";
import { resolveAttachmentsAction } from "./attachments";
import { enqueueSttRunAction, pollSttRunStatusAction } from "./stt-actions";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

/** YouTube video/shorts or Instagram reel/post URLs — matches the actors wired up in apify.ts. */
const VIDEO_URL_PATTERN =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/|instagram\.com\/(reel|p|tv)\/)/i;

type InputMode = "upload" | "link";

/**
 * Speech-to-text: transcribes an uploaded video/audio file, or a YouTube/
 * Instagram URL, via ElevenLabs Scribe v2, then summarizes with Gemini.
 * URL mode downloads the video via Apify first (ElevenLabs' own source_url
 * fetch is unreliable against both hosts), stages it in our storage, then
 * hands ElevenLabs a plain hosted URL — see apify.ts / execute-stt-run.ts.
 */
export function SttPanel() {
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [summaryWords, setSummaryWords] = useState(200);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTranscript(null);
    setSummary(null);
    setAssetId(null);

    let sourceUrl: string;
    if (inputMode === "link") {
      const trimmed = linkUrl.trim();
      if (!trimmed) {
        setError("Enter a video URL.");
        return;
      }
      if (!VIDEO_URL_PATTERN.test(trimmed)) {
        setError("Enter a YouTube video/shorts URL or an Instagram reel/post URL.");
        return;
      }
      sourceUrl = trimmed;
    } else {
      if (!file) {
        setError("Choose a video or audio file.");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`File is ${(file.size / 1024 / 1024).toFixed(0)}MB — max is 100MB.`);
        return;
      }
      setPending(true);
      setStatusLabel("Uploading…");
      try {
        const { uploadUrl, storageKey } = await requestUploadUrlAction({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        });
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

        const asset = await confirmUploadAction({
          storageKey,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          folderId: null,
          sizeBytes: file.size,
        });
        if (!asset) throw new Error("Upload did not return an asset");
        const [resolved] = await resolveAttachmentsAction([asset.id]);
        if (!resolved) throw new Error("Could not resolve an accessible URL for the uploaded file");
        sourceUrl = resolved.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setPending(false);
        setStatusLabel(null);
        return;
      }
    }

    setPending(true);
    setStatusLabel("Queued…");
    try {
      const { runId } = await enqueueSttRunAction(sourceUrl, summaryWords);
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const status = await pollSttRunStatusAction(runId);
        setStatusLabel(status.status === "running" ? "Transcribing…" : status.status);
        if (TERMINAL_STATUSES.has(status.status)) {
          if (status.status === "failed") {
            setError(status.error ?? "Transcription failed");
          } else {
            setTranscript(status.transcript ?? null);
            setSummary(status.summary ?? null);
            setAssetId(status.assetId ?? null);
          }
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setPending(false);
      setStatusLabel(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-1 rounded-none border border-ink/10 bg-ink/5 p-1">
          {(["upload", "link"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setInputMode(m)}
              className={`flex-1 rounded-none px-3 py-2 text-sm font-medium transition ${
                inputMode === m ? "bg-[#004c37] text-white" : "text-ink/60 hover:text-ink/90"
              }`}
            >
              {m === "upload" ? "Upload video/audio" : "Video URL"}
            </button>
          ))}
        </div>

        {inputMode === "upload" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Video or audio file</label>
            <DropZone onFiles={(files) => setFile(files[0] ?? null)}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-none border border-dashed border-ink/25 px-3 py-6 text-sm text-ink/60 hover:border-ink/40 hover:text-ink/90"
              >
                {file ? file.name : "Click or drop a video/audio file (max 100MB)"}
              </button>
            </DropZone>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Video URL</label>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="YouTube video/shorts or Instagram reel URL"
              className="w-full rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/25 focus:outline-none"
            />
            <p className="text-xs text-ink/40">
              YouTube (video or shorts) or Instagram (reel/post) only. Videos up to ~1 hour.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">
            Summary length <span className="text-ink/40">({summaryWords === 0 ? "no summary" : `~${summaryWords} words`})</span>
          </label>
          <input
            type="range"
            min={0}
            max={300}
            step={50}
            value={summaryWords}
            onChange={(e) => setSummaryWords(Number(e.target.value))}
            className="w-full accent-[#004c37]"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-none bg-[#004c37] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#00614a] disabled:opacity-50"
        >
          {pending ? (statusLabel ?? "Working…") : "Transcribe"}
        </button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium font-mono uppercase tracking-[0.15em] text-ink/40">Output</h2>
          {assetId && (
            <Link href="/assets" className="text-xs text-ink/50 hover:text-ink/80">
              View in Asset Library →
            </Link>
          )}
        </div>

        {error && (
          <div className="rounded-none border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">{error}</div>
        )}

        {!error && !transcript && !pending && (
          <div className="rounded-none border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/40">
            Transcript and summary will appear here.
          </div>
        )}

        {(summary || transcript) && (
          <div className="max-h-[560px] space-y-4 overflow-y-auto rounded-none border border-ink/10 bg-ink/5 p-4">
            {summary && (
              <div className="space-y-1">
                <p className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Summary</p>
                <p className="whitespace-pre-wrap text-sm text-ink/80">{summary}</p>
              </div>
            )}
            {transcript && (
              <div className="space-y-1">
                <p className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Transcript</p>
                <p className="whitespace-pre-wrap text-sm text-ink/70">{transcript}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
