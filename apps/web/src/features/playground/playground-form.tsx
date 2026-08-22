"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MODEL_REGISTRY, defaultSettingsFor, estimateCost, type ModelCategory } from "@superos/model-registry";
import { enqueueGenerationAction, getLatestRunForModelAction, getRunOutputPreviewsAction, pollRunStatusAction } from "./actions";
import { AttachmentsPicker, type Attachment } from "./attachments-picker";
import { SttPanel } from "./stt-panel";
import { ScriptPanel } from "./script-panel";
import { ModelSettingsFields } from "@/features/shared/model-settings-fields";
import type { LatestPlaygroundRun } from "./queries";

const POLL_INTERVAL_MS = 1500;
const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);

const MODES: { value: ModelCategory; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
];

interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

export interface PlaygroundSeed {
  action: "edit" | "remix";
  modelId: string;
  prompt: string;
  settings: Record<string, unknown>;
  attachments: Attachment[];
}

const IN_FLIGHT_STATUSES = new Set(["queued", "running"]);

export function PlaygroundForm({
  folders,
  latestRun,
  seed,
}: {
  folders: FolderOption[];
  latestRun: LatestPlaygroundRun | null;
  seed: PlaygroundSeed | null;
}) {
  const [mode, setMode] = useState<ModelCategory>(() => {
    if (seed) return MODEL_REGISTRY.find((m) => m.id === seed.modelId)?.category ?? "image";
    return "image";
  });
  // STT and Script are separate, non-model-driven flows — not generic ModelCategory tabs.
  const [extraTab, setExtraTab] = useState<"stt" | "script" | null>(null);
  const modelsForMode = useMemo(
    () => MODEL_REGISTRY.filter((m) => m.category === mode && m.status === "active"),
    [mode],
  );
  const [modelId, setModelId] = useState(seed?.modelId ?? modelsForMode[0]?.id ?? "");
  // Prompt is remembered per mode (image/audio/video) — switching mode restores
  // whatever was last typed there, rather than carrying over another mode's text.
  const [promptsByMode, setPromptsByMode] = useState<Record<ModelCategory, string>>(() => {
    const base = { image: "", audio: "", video: "" };
    if (seed) base[mode] = seed.prompt;
    return base;
  });
  const prompt = promptsByMode[mode];
  function setPrompt(value: string) {
    setPromptsByMode((prev) => ({ ...prev, [mode]: value }));
  }
  // Settings are remembered per model, in their own bucket — never merged
  // across models, since two different models can share a field name (e.g.
  // "resolution") with entirely different valid values/meaning.
  const [settingsByModel, setSettingsByModel] = useState<Record<string, Record<string, unknown>>>(() => ({
    [modelId]: seed?.settings ?? defaultSettingsFor(modelId),
  }));
  const settings = settingsByModel[modelId] ?? defaultSettingsFor(modelId);
  function setSettings(next: Record<string, unknown>) {
    setSettingsByModel((prev) => ({ ...prev, [modelId]: next }));
  }
  const [attachments, setAttachments] = useState<Attachment[]>(seed?.attachments ?? []);
  const [folderId, setFolderId] = useState<string>("");
  const isResuming = latestRun ? IN_FLIGHT_STATUSES.has(latestRun.status) : false;
  const [pending, setPending] = useState(isResuming);
  const [statusLabel, setStatusLabel] = useState<string | null>(isResuming ? "Generating…" : null);
  const [error, setError] = useState<string | null>(latestRun?.status === "failed" ? (latestRun.error ?? "Generation failed") : null);
  const [resultAssets, setResultAssets] = useState<LatestPlaygroundRun["outputs"]>(latestRun?.outputs ?? []);
  const [pendingCount, setPendingCount] = useState(isResuming ? (latestRun?.count ?? 1) : 0);

  // The output box must only ever reflect the currently selected model's own
  // history — pollUntilDone can span a model switch (it keeps running against
  // whatever run it was started for), so every state write it makes is guarded
  // against the model the user is looking at *right now*, not the one it was called for.
  const currentModelIdRef = useRef(modelId);
  useEffect(() => {
    currentModelIdRef.current = modelId;
  }, [modelId]);

  // A run started before a page navigation/refresh keeps generating server-side
  // (queue/worker, not tied to this component) — resume polling it here so its
  // result or error still shows up when the user comes back, instead of vanishing.
  useEffect(() => {
    if (!latestRun || !IN_FLIGHT_STATUSES.has(latestRun.status)) return;
    pollUntilDone(latestRun.runId, modelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume only on initial mount, for the run id/model the page loaded with
  }, []);

  // Re-derive the output box whenever the selected model changes, scoped to
  // that model's own most recent run only — never another model's outputs.
  const isFirstModelEffect = useRef(true);
  useEffect(() => {
    if (isFirstModelEffect.current) {
      isFirstModelEffect.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const run = await getLatestRunForModelAction(modelId);
      if (cancelled || currentModelIdRef.current !== modelId) return;

      if (!run) {
        setError(null);
        setResultAssets([]);
        setPending(false);
        setPendingCount(0);
        setStatusLabel(null);
      } else if (run.status === "failed") {
        setError(run.error ?? "Generation failed");
        setResultAssets([]);
        setPending(false);
        setPendingCount(0);
        setStatusLabel(null);
      } else if (IN_FLIGHT_STATUSES.has(run.status)) {
        setError(null);
        setResultAssets([]);
        setPending(true);
        setPendingCount(run.count);
        setStatusLabel("Generating…");
        pollUntilDone(run.runId, modelId);
      } else {
        setError(null);
        setResultAssets(run.outputs);
        setPending(false);
        setPendingCount(0);
        setStatusLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  async function pollUntilDone(runId: string, forModelId: string) {
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const status = await pollRunStatusAction(runId);
        if (currentModelIdRef.current === forModelId) {
          setStatusLabel(status.status === "running" ? "Generating…" : status.status);
        }

        if (TERMINAL_STATUSES.has(status.status)) {
          if (status.status === "failed") {
            if (currentModelIdRef.current === forModelId) setError(status.error ?? "Generation failed");
          } else {
            const previews = await getRunOutputPreviewsAction(status.assetIds);
            if (currentModelIdRef.current === forModelId) {
              setResultAssets((prev) => [...previews, ...prev]);
            }
          }
          break;
        }
      }
    } catch (err) {
      if (currentModelIdRef.current === forModelId) setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      if (currentModelIdRef.current === forModelId) {
        setPending(false);
        setPendingCount(0);
        setStatusLabel(null);
      }
    }
  }

  function switchMode(next: ModelCategory) {
    setMode(next);
    const first = MODEL_REGISTRY.find((m) => m.category === next && m.status === "active");
    setModelId(first?.id ?? "");
    setAttachments([]);
    setError(null);
    setResultAssets([]);
    setPending(false);
    setPendingCount(0);
    setStatusLabel(null);
  }

  function switchModel(id: string) {
    setModelId(id);
    setAttachments([]);
    setError(null);
    setResultAssets([]);
    setPending(false);
    setPendingCount(0);
    setStatusLabel(null);
  }

  const selectedModel = MODEL_REGISTRY.find((m) => m.id === modelId);
  const attachableDataTypes = useMemo(
    () => selectedModel?.inputTypes.filter((t) => t !== "text") ?? [],
    [selectedModel],
  );
  const estimate = modelId
    ? estimateCost({
        modelId,
        count: Math.max(1, Number(settings.count) || 1),
        seconds: Number(settings.durationSeconds ?? settings.duration ?? 1),
        characters: prompt.length,
        settings,
      })
    : null;
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    setError(null);
    setPendingCount(Math.max(1, Number(settings.count) || 1));
    setStatusLabel("Queued…");

    try {
      const { runId } = await enqueueGenerationAction({
        modelId,
        prompt,
        settings,
        folderId: folderId || null,
        attachments,
      });

      // Video (Veo) can poll for minutes server-side — this just polls the
      // lightweight run status row, never blocking on the generation call itself.
      await pollUntilDone(runId, modelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setPending(false);
      setPendingCount(0);
      setStatusLabel(null);
    }
  }

  const tabBar = (
    <div className="flex gap-1 rounded-none border border-ink/10 bg-ink/5 p-1">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => {
            setExtraTab(null);
            switchMode(m.value);
          }}
          className={`flex-1 rounded-none px-3 py-2 text-sm font-medium transition ${
            !extraTab && mode === m.value ? "bg-[#004c37] text-white" : "text-ink/60 hover:text-ink/90"
          }`}
        >
          {m.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setExtraTab("stt")}
        className={`flex-1 rounded-none px-3 py-2 text-sm font-medium transition ${
          extraTab === "stt" ? "bg-[#004c37] text-white" : "text-ink/60 hover:text-ink/90"
        }`}
      >
        STT
      </button>
      <button
        type="button"
        onClick={() => setExtraTab("script")}
        className={`flex-1 rounded-none px-3 py-2 text-sm font-medium transition ${
          extraTab === "script" ? "bg-[#004c37] text-white" : "text-ink/60 hover:text-ink/90"
        }`}
      >
        Script
      </button>
    </div>
  );

  if (extraTab === "stt") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        {tabBar}
        <div className="mt-8">
          <SttPanel />
        </div>
      </div>
    );
  }

  if (extraTab === "script") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        {tabBar}
        <div className="mt-8">
          <ScriptPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {tabBar}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // Enter in a single-line field (bulk count, sliders, etc.) implicitly submits
          // the form per HTML default — only the multi-line prompt textarea should accept it.
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="space-y-5"
      >
        {seed && (
          <div className="border border-ink/15 bg-ink/5 px-3 py-2 text-xs text-ink/60">
            {seed.action === "edit" ? "Editing an asset — attached as reference below." : "Remixing a previous generation — tweak and go."}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Model</label>
          <select
            value={modelId}
            onChange={(e) => switchModel(e.target.value)}
            className="w-full rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink focus:border-ink/25 focus:outline-none"
          >
            {modelsForMode.map((m) => (
              <option key={m.id} value={m.id} className="bg-white">
                {m.label}
              </option>
            ))}
          </select>
          {selectedModel?.notes && <p className="text-xs text-ink/40">{selectedModel.notes}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            required
            placeholder="Describe what to generate…"
            className="w-full resize-none rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/25 focus:outline-none"
          />
        </div>

        {attachableDataTypes.length > 0 && (
          <AttachmentsPicker dataTypes={attachableDataTypes} attachments={attachments} onChange={setAttachments} />
        )}

        <div className="rounded-none border border-ink/10 bg-ink/5 p-3">
          <p className="mb-2 text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Settings</p>
          <ModelSettingsFields modelId={modelId} settings={settings} onChange={setSettings} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">
            Save to folder
          </label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink focus:border-ink/25 focus:outline-none"
          >
            <option value="" className="bg-white">
              Asset Library (root)
            </option>
            {folders.map((f) => (
              <option key={f.id} value={f.id} className="bg-white">
                {"—".repeat(f.depth)} {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between rounded-none border border-ink/10 bg-ink/5 px-4 py-3 text-sm">
          <span className="text-ink/50">Estimated cost</span>
          <span className="text-ink/80">
            {estimate?.verified && estimate.estimatedUsd !== null
              ? `$${estimate.estimatedUsd.toFixed(3)}`
              : "unverified pricing"}
          </span>
        </div>

        <button
          type="submit"
          disabled={pending || !modelId}
          className="w-full rounded-none bg-[#004c37] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#00614a] disabled:opacity-50"
        >
          {pending ? (statusLabel ?? "Generating…") : "Generate"}
        </button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium font-mono uppercase tracking-[0.15em] text-ink/40">Output</h2>
          {resultAssets.length > 0 && (
            <Link href={folderId ? `/assets?folder=${folderId}` : "/assets"} className="text-xs text-ink/50 hover:text-ink/80">
              View in Asset Library →
            </Link>
          )}
        </div>

        {error && (
          <div className="rounded-none border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!error && pendingCount === 0 && resultAssets.length === 0 && (
          <div className="rounded-none border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/40">
            Generated output will appear here and save to the Asset Library.
          </div>
        )}

        {(pendingCount > 0 || resultAssets.length > 0) && (
          <div className="max-h-[560px] overflow-y-auto rounded-none border border-ink/10 bg-ink/5 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: pendingCount }).map((_, i) => (
                <div key={`pending-${i}`} className="aspect-square animate-pulse bg-ink/10" />
              ))}
              {resultAssets.map((asset) => (
                <OutputTile key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function OutputTile({ asset }: { asset: LatestPlaygroundRun["outputs"][number] }) {
  if (!asset.previewUrl) {
    return <div className="flex aspect-square items-center justify-center bg-ink/10 text-[10px] text-ink/40">Preview unavailable</div>;
  }

  if (asset.type === "image") {
    return (
      <a href={asset.previewUrl} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden bg-ink/10">
        <img src={asset.previewUrl} alt="" className="h-full w-full object-cover" />
      </a>
    );
  }

  if (asset.type === "video") {
    return (
      <video src={asset.previewUrl} controls className="aspect-square w-full bg-black object-contain">
        Your browser does not support video playback.
      </video>
    );
  }

  if (asset.type === "audio") {
    return (
      <div className="col-span-2 flex aspect-[4/1] items-center bg-ink/10 px-2 sm:col-span-3">
        <audio src={asset.previewUrl} controls className="w-full" />
      </div>
    );
  }

  return (
    <a
      href={asset.previewUrl}
      target="_blank"
      rel="noreferrer"
      className="flex aspect-square items-center justify-center bg-ink/10 text-[10px] text-ink/40 hover:text-ink/70"
    >
      Open file →
    </a>
  );
}
