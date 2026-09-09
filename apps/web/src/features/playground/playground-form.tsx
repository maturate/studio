"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MODEL_REGISTRY, defaultSettingsFor, estimateCost, type ModelCategory } from "@superos/model-registry";
import { resolveAttachmentTags, type DataType } from "@superos/shared";
import { enqueueGenerationAction, getLatestRunForModelAction, getRunOutputPreviewsAction, pollRunStatusAction, resolveAssetSeedAction } from "./actions";
import { AttachmentsPicker, type Attachment } from "./attachments-picker";
import { SttPanel } from "./stt-panel";
import { ScriptPanel } from "./script-panel";
import { ModelSettingsFields } from "@/features/shared/model-settings-fields";
import { AssetPreviewModal, type AssetCardData } from "@/features/assets/components/asset-preview-modal";
import { getAssetPreviewDataAction } from "@/features/assets/actions";
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
  // Selected model is remembered per mode (image/audio/video) — switching tabs restores
  // whichever model was last active there instead of resetting to that category's first
  // model. Without this, switching away mid-generation (e.g. right after a Remix) and
  // back loses track of the in-flight run entirely, since it's tied to a specific model
  // id and the output panel would otherwise start looking at the wrong one.
  const [modelIdByMode, setModelIdByMode] = useState<Record<ModelCategory, string>>(() => {
    const firstOf = (category: ModelCategory) =>
      MODEL_REGISTRY.find((m) => m.category === category && m.status === "active")?.id ?? "";
    const base = { image: firstOf("image"), audio: firstOf("audio"), video: firstOf("video") };
    if (seed) base[mode] = seed.modelId;
    return base;
  });
  const modelId = modelIdByMode[mode];
  function setModelId(id: string) {
    setModelIdByMode((prev) => ({ ...prev, [mode]: id }));
  }
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
  // Attachments are remembered per model, same bucket shape as settings — switching
  // tabs or models (including switching away mid-generation and back) must not lose
  // a reference the user attached, since that's exactly the input a Remix/Edit or an
  // in-flight run depends on. Only an explicit "no reference for this model yet" is
  // an empty array; it's never forced empty on a mode/model switch.
  const [attachmentsByModel, setAttachmentsByModel] = useState<Record<string, Attachment[]>>(() => ({
    [modelId]: seed?.attachments ?? [],
  }));
  const attachments = attachmentsByModel[modelId] ?? [];
  function setAttachments(next: Attachment[]) {
    setAttachmentsByModel((prev) => ({ ...prev, [modelId]: next }));
  }
  const [folderId, setFolderId] = useState<string>("");
  const isResuming = latestRun ? IN_FLIGHT_STATUSES.has(latestRun.status) : false;
  const [pending, setPending] = useState(isResuming);
  const [statusLabel, setStatusLabel] = useState<string | null>(isResuming ? "Generating…" : null);
  const [error, setError] = useState<string | null>(latestRun?.status === "failed" ? (latestRun.error ?? "Generation failed") : null);
  const [resultAssets, setResultAssets] = useState<LatestPlaygroundRun["outputs"]>(latestRun?.outputs ?? []);
  const [pendingCount, setPendingCount] = useState(isResuming ? (latestRun?.count ?? 1) : 0);
  const [activeSeedAction, setActiveSeedAction] = useState<PlaygroundSeed["action"] | null>(seed?.action ?? null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // "@" mention autocomplete for tagging a specific attachment in the prompt —
  // mentionQuery is the text typed after the triggering "@" (null = closed).
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return attachments
      .map((a, i) => ({ ...a, tagIndex: i + 1 }))
      .filter((a) => !q || a.title.toLowerCase().includes(q));
  }, [mentionQuery, attachments]);

  function detectMentionQuery(value: string, cursor: number): string | null {
    const uptoCursor = value.slice(0, cursor);
    const at = uptoCursor.lastIndexOf("@");
    if (at === -1) return null;
    const between = uptoCursor.slice(at + 1);
    if (/\s/.test(between)) return null; // whitespace after "@" ends the mention
    return between;
  }

  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    setMentionQuery(detectMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length));
    setMentionIndex(0);
  }

  function insertMention(tagIndex: number) {
    const el = promptRef.current;
    const cursor = el?.selectionStart ?? prompt.length;
    const uptoCursor = prompt.slice(0, cursor);
    const at = uptoCursor.lastIndexOf("@");
    if (at === -1) return;
    const tag = `@attachment-${tagIndex} `;
    const nextPrompt = prompt.slice(0, at) + tag + prompt.slice(cursor);
    setPrompt(nextPrompt);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = at + tag.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || mentionMatches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionMatches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(mentionMatches[mentionIndex].tagIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionQuery(null);
    }
  }

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
    setError(null);
    setResultAssets([]);
    setPending(false);
    setPendingCount(0);
    setStatusLabel(null);
    setActiveSeedAction(null);
    setSeedError(null);
  }

  function switchModel(id: string) {
    setModelId(id);
    setError(null);
    setResultAssets([]);
    setPending(false);
    setPendingCount(0);
    setStatusLabel(null);
    setActiveSeedAction(null);
    setSeedError(null);
  }

  /** Applies an Edit/Remix seed resolved from an existing asset — same reconstruction
   * the Asset Library's Edit/Remix links use, just applied in place instead of navigating.
   * Deliberately leaves resultAssets/pending/statusLabel untouched — Edit/Remix only
   * pre-fills the form, it doesn't start a generation, so whatever's currently shown
   * in the output panel (including the very asset being edited/remixed) should stay
   * visible until a new generation actually completes. */
  function applySeed(next: PlaygroundSeed) {
    const nextModel = MODEL_REGISTRY.find((m) => m.id === next.modelId);
    if (nextModel) setMode(nextModel.category);
    setModelId(next.modelId);
    setPromptsByMode((prev) => ({ ...prev, [nextModel?.category ?? mode]: next.prompt }));
    setSettingsByModel((prev) => ({ ...prev, [next.modelId]: next.settings }));
    setAttachments(next.attachments);
    setActiveSeedAction(next.action);
    setSeedError(null);
    setError(null);
  }

  async function handleEditOrRemix(assetId: string, action: "edit" | "remix") {
    setSeedError(null);
    const next = await resolveAssetSeedAction(assetId, action);
    if (!next) {
      setSeedError(action === "edit" ? "This model can't take that output back as input." : "Couldn't reconstruct the original inputs for this output.");
      return;
    }
    applySeed(next);
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
        // "@attachment-1"/"@attachment-2" etc. in the prompt get swapped for that
        // attachment's real title right before it reaches the model — the tag
        // itself means nothing to the model, the name does.
        prompt: resolveAttachmentTags(prompt, attachments.map((a) => a.title)),
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
      <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_1fr]">
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
        {activeSeedAction && (
          <div className="border border-ink/15 bg-ink/5 px-3 py-2 text-xs text-ink/60">
            {activeSeedAction === "edit" ? "Editing an asset — attached as reference below." : "Remixing a previous generation — tweak and go."}
          </div>
        )}
        {seedError && (
          <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">{seedError}</div>
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
        </div>

        <div className="relative space-y-1.5">
          <label className="text-xs font-medium font-mono uppercase tracking-wide text-ink/45">Prompt</label>
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handlePromptKeyDown}
            onBlur={() => setMentionQuery(null)}
            rows={5}
            required={attachments.length === 0}
            placeholder={
              attachments.length > 0
                ? "Optional when media is attached — describe the shot or leave blank… (type @ to tag one)"
                : "Describe what to generate…"
            }
            className="w-full resize-none rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/25 focus:outline-none"
          />
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto border border-ink/15 bg-white shadow-lg">
              {mentionMatches.map((m, i) => (
                <button
                  key={m.assetId}
                  type="button"
                  // onMouseDown (not onClick) fires before the textarea's onBlur, so
                  // selecting an item doesn't first close the dropdown out from under it.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m.tagIndex);
                  }}
                  onMouseEnter={() => setMentionIndex(i)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                    i === mentionIndex ? "bg-[#004c37] text-white" : "text-ink/80 hover:bg-ink/5"
                  }`}
                >
                  <code
                    className={`shrink-0 rounded-none px-1 py-0.5 text-[10px] ${
                      i === mentionIndex ? "bg-white/20" : "bg-ink/10 text-ink/60"
                    }`}
                  >
                    @attachment-{m.tagIndex}
                  </code>
                  <span className="truncate">{m.title || "untitled"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {attachableDataTypes.length > 0 && (
          <AttachmentsPicker dataTypes={attachableDataTypes} attachments={attachments} onChange={setAttachments} />
        )}

        {attachments.length > 1 && (
          <p className="text-xs text-ink/40">
            Reference a specific one in the prompt by position:{" "}
            {attachments.map((a, i) => (
              <span key={a.assetId}>
                <code className="rounded-none bg-ink/10 px-1 py-0.5 text-ink/70">@attachment-{i + 1}</code>
                {" → "}
                {a.title || "untitled"}
                {i < attachments.length - 1 ? "; " : ""}
              </span>
            ))}
          </p>
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
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto rounded-none border border-ink/10 bg-ink/5 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: pendingCount }).map((_, i) => (
                <div key={`pending-${i}`} className="aspect-square animate-pulse bg-ink/10" />
              ))}
              {resultAssets.map((asset) => (
                <OutputTile
                  key={asset.id}
                  asset={asset}
                  canEdit={Boolean(selectedModel?.inputTypes.includes(asset.type as DataType))}
                  onEdit={() => handleEditOrRemix(asset.id, "edit")}
                  onRemix={() => handleEditOrRemix(asset.id, "remix")}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function OutputTile({
  asset,
  canEdit,
  onEdit,
  onRemix,
}: {
  asset: LatestPlaygroundRun["outputs"][number];
  canEdit: boolean;
  onEdit: () => void;
  onRemix: () => void;
}) {
  const [previewData, setPreviewData] = useState<AssetCardData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function openPreview() {
    setPreviewLoading(true);
    try {
      const data = await getAssetPreviewDataAction(asset.id);
      if (data) setPreviewData(data);
    } finally {
      setPreviewLoading(false);
    }
  }

  const actionBar = (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/75 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="pointer-events-auto rounded-none bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/80"
        >
          Edit
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemix();
        }}
        className="pointer-events-auto rounded-none bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/80"
      >
        Remix
      </button>
    </div>
  );

  if (!asset.previewUrl) {
    return <div className="flex aspect-square items-center justify-center bg-ink/10 text-[10px] text-ink/40">Preview unavailable</div>;
  }

  // Image/video/generic-file tiles open the same AssetPreviewModal lightbox the Asset
  // Library uses — clicking anywhere on the tile opens it, exactly like a library card.
  if (asset.type === "image") {
    return (
      <>
        <button type="button" onClick={openPreview} className="group relative block aspect-square overflow-hidden bg-ink/10">
          <img src={asset.previewUrl} alt="" className="h-full w-full object-cover" />
          {previewLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white">Loading…</div>}
          {actionBar}
        </button>
        {previewData && (
          <AssetPreviewModal
            asset={previewData}
            onClose={() => setPreviewData(null)}
            onEdit={() => {
              setPreviewData(null);
              onEdit();
            }}
            onRemix={() => {
              setPreviewData(null);
              onRemix();
            }}
          />
        )}
      </>
    );
  }

  if (asset.type === "video") {
    return (
      <>
        <button type="button" onClick={openPreview} className="group relative block aspect-square bg-black">
          <video src={asset.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-contain" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl text-white/90">▶</div>
          {previewLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white">Loading…</div>}
          {actionBar}
        </button>
        {previewData && (
          <AssetPreviewModal
            asset={previewData}
            onClose={() => setPreviewData(null)}
            onEdit={() => {
              setPreviewData(null);
              onEdit();
            }}
            onRemix={() => {
              setPreviewData(null);
              onRemix();
            }}
          />
        )}
      </>
    );
  }

  if (asset.type === "audio") {
    return (
      <div className="group relative col-span-2 flex aspect-[4/1] items-center bg-ink/10 px-2 sm:col-span-3">
        <audio src={asset.previewUrl} controls className="w-full" />
        {actionBar}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        className="group relative flex aspect-square items-center justify-center bg-ink/10 text-[10px] text-ink/40 hover:text-ink/70"
      >
        Open file →
        {actionBar}
      </button>
      {previewData && (
        <AssetPreviewModal
          asset={previewData}
          onClose={() => setPreviewData(null)}
          onEdit={() => {
            setPreviewData(null);
            onEdit();
          }}
          onRemix={() => {
            setPreviewData(null);
            onRemix();
          }}
        />
      )}
    </>
  );
}
