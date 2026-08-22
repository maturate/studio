"use client";

import { useEffect, useRef, useState } from "react";
import { getSettingsSchema, type SettingField } from "@superos/model-registry";
import { listElevenLabsVoicesAction, type ElevenLabsVoiceOption } from "./elevenlabs-actions";
import { previewGeminiVoiceAction } from "./gemini-tts-preview-actions";

const fieldCls =
  "w-full rounded-none border border-ink/15 bg-white px-2 py-1.5 text-xs text-ink focus:border-ink/30 focus:outline-none";
const labelCls = "text-[10px] font-medium uppercase tracking-wide text-ink/45";

// Every ModelSettingsFields instance (one per node/form) shares this fetch —
// a workflow canvas can have many audio-generator nodes at once and they
// should all reuse one round trip to ElevenLabs, not fetch independently.
let elevenLabsVoicesPromise: Promise<ElevenLabsVoiceOption[]> | null = null;
function getElevenLabsVoicesOnce(): Promise<ElevenLabsVoiceOption[]> {
  if (!elevenLabsVoicesPromise) elevenLabsVoicesPromise = listElevenLabsVoicesAction().catch(() => []);
  return elevenLabsVoicesPromise;
}

// Gemini TTS previews are generated for real on demand — cache clips client-side
// too (beyond the server-side cache) so switching back to a voice replays instantly.
const geminiPreviewCache = new Map<string, Promise<string>>();
function getGeminiPreviewOnce(voiceName: string): Promise<string> {
  let cached = geminiPreviewCache.get(voiceName);
  if (!cached) {
    cached = previewGeminiVoiceAction(voiceName);
    geminiPreviewCache.set(voiceName, cached);
    cached.catch(() => geminiPreviewCache.delete(voiceName));
  }
  return cached;
}

/**
 * Typed settings form driven by @superos/model-registry's SETTINGS_SCHEMA —
 * real per-model controls (selects/sliders/checkboxes), never a JSON
 * textarea. `count` (bulk output count) is universal across every generator
 * model, so it's rendered here rather than duplicated per model schema.
 * Shared between Playground and the Workflow node editor so the two never
 * diverge on what a model's settings look like (AGENTS.md hard rule 7).
 */
export function ModelSettingsFields({
  modelId,
  settings,
  onChange,
  showCount = true,
  compact = false,
}: {
  modelId: string;
  settings: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  showCount?: boolean;
  compact?: boolean;
}) {
  const schema = getSettingsSchema(modelId);

  function set(key: string, value: unknown) {
    onChange({ ...settings, [key]: value });
  }

  if (schema.length === 0 && !showCount) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {schema.map((field) => (
        <FieldControl key={field.key} field={field} value={settings[field.key]} onChange={(v) => set(field.key, v)} />
      ))}
      {showCount && (
        <div className="space-y-1">
          <label className={labelCls}>Outputs (bulk count)</label>
          <input
            type="number"
            min={1}
            max={50}
            value={(settings.count as number | undefined) ?? 1}
            onChange={(e) => set("count", Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className={fieldCls}
          />
        </div>
      )}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "voice-select") {
    return <VoiceSelectField field={field} value={value} onChange={onChange} />;
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <label className={labelCls}>{field.label}</label>
        <select value={(value as string) ?? field.default} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.hint && <p className="text-[10px] text-ink/35">{field.hint}</p>}
      </div>
    );
  }

  if (field.type === "range") {
    const current = (value as number | undefined) ?? field.default;
    return (
      <div className="space-y-1">
        <label className={labelCls}>
          {field.label} <span className="text-ink/40">({current})</span>
        </label>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-[#004c37]"
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-1">
        <label className={labelCls}>{field.label}</label>
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={(value as number | undefined) ?? field.default}
          onChange={(e) => onChange(Number(e.target.value))}
          className={fieldCls}
        />
        {field.hint && <p className="text-[10px] text-ink/35">{field.hint}</p>}
      </div>
    );
  }

  // boolean
  return (
    <label className="flex items-center gap-2 text-xs text-ink/70">
      <input
        type="checkbox"
        checked={(value as boolean | undefined) ?? field.default}
        onChange={(e) => onChange(e.target.checked)}
      />
      {field.label}
    </label>
  );
}

interface VoiceOption {
  value: string;
  label: string;
  /** Resolves to a playable audio URL/data URI. Fetched lazily (Gemini) or already known (ElevenLabs). */
  getPreviewUrl: () => Promise<string>;
}

/** Custom listbox (not a native `<select>`) so every row can carry its own play button. */
function VoiceSelectField({
  field,
  value,
  onChange,
}: {
  field: Extract<SettingField, { type: "voice-select" }>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [options, setOptions] = useState<VoiceOption[] | null>(field.source === "gemini-tts" ? null : null);
  const [open, setOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [playingValue, setPlayingValue] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (field.source === "elevenlabs") {
      getElevenLabsVoicesOnce().then((voices) => {
        if (cancelled) return;
        setOptions(
          voices.map((v) => ({
            value: v.voiceId,
            label: v.name,
            getPreviewUrl: async () => {
              if (!v.previewUrl) throw new Error("No preview available for this voice");
              return v.previewUrl;
            },
          })),
        );
      });
    } else {
      setOptions(
        field.options.map((name) => ({
          value: name,
          label: name,
          getPreviewUrl: () => getGeminiPreviewOnce(name),
        })),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [field]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  async function playPreview(opt: VoiceOption) {
    if (playingValue === opt.value) {
      audioRef.current?.pause();
      setPlayingValue(null);
      return;
    }
    audioRef.current?.pause();
    setLoadingPreview(opt.value);
    try {
      const url = await opt.getPreviewUrl();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingValue(null);
      await audio.play();
      setPlayingValue(opt.value);
    } catch {
      // Silently no-op — a missing/failed preview shouldn't block picking the voice.
    } finally {
      setLoadingPreview(null);
    }
  }

  const selectedValue = (value as string) ?? (field.source === "gemini-tts" ? field.default : "");
  const selectedOption = options?.find((o) => o.value === selectedValue);

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className={labelCls}>{field.label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${fieldCls} flex items-center justify-between text-left`}
        >
          <span className="truncate">
            {options === null ? "Loading voices…" : (selectedOption?.label ?? "Select a voice…")}
          </span>
          <span className="text-ink/30">▾</span>
        </button>

        {open && options !== null && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto border border-ink/15 bg-white shadow-lg">
            {options.length === 0 && (
              <p className="px-2 py-2 text-xs text-red-600">No voices found — check ELEVENLABS_API_KEY.</p>
            )}
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-ink/5 ${
                  opt.value === selectedValue ? "bg-ink/5" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPreview(opt);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink/20 text-[10px] text-ink/60 hover:border-ink/40 hover:text-ink/90"
                  title="Preview voice"
                >
                  {loadingPreview === opt.value ? "…" : playingValue === opt.value ? "❚❚" : "▶"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="flex-1 truncate text-left text-ink/80"
                >
                  {opt.label}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {field.hint && <p className="text-[10px] text-ink/35">{field.hint}</p>}
    </div>
  );
}
