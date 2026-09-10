"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SCRIPT_SERIES, getScriptSeries, type ScriptField } from "./script-series";
import { generateScriptAction } from "./script-actions";

const fieldCls =
  "w-full rounded-none border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink placeholder:text-ink/30 focus:border-ink/30 focus:outline-none";
const labelCls = "text-xs font-medium font-mono uppercase tracking-wide text-ink/45";

export function ScriptPanel() {
  const [seriesId, setSeriesId] = useState(SCRIPT_SERIES[0]!.id);
  const series = useMemo(() => getScriptSeries(seriesId)!, [seriesId]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [manualScript, setManualScript] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function switchSeries(id: string) {
    setSeriesId(id);
    setValues({});
    setManualScript("");
    setScript(null);
    setAssetId(null);
    setError(null);
  }

  function setField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (series.mode === "manual") return;
    setPending(true);
    setError(null);
    setScript(null);
    setAssetId(null);
    try {
      const result = await generateScriptAction(series.id, values);
      if (result.error || !result.script) {
        setError(result.error ?? "Script generation failed");
        return;
      }
      setScript(result.script);
      setAssetId(result.assetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className={labelCls}>Series</label>
          <select
            value={seriesId}
            onChange={(e) => switchSeries(e.target.value)}
            className="w-full rounded-none border border-ink/10 bg-ink/5 px-3 py-2 text-sm text-ink focus:border-ink/25 focus:outline-none"
          >
            <optgroup label="Main account">
              {SCRIPT_SERIES.filter((s) => s.account === "main").map((s) => (
                <option key={s.id} value={s.id} className="bg-white">
                  {s.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sub accounts">
              {SCRIPT_SERIES.filter((s) => s.account === "sub").map((s) => (
                <option key={s.id} value={s.id} className="bg-white">
                  {s.label}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="text-xs text-ink/40">
            {series.character}
            {!series.tuned && series.mode === "ai" && (
              <span className="text-amber-700"> — draft prompt, not yet tuned with reference material</span>
            )}
          </p>
        </div>

        {series.mode === "manual" ? (
          <div className="space-y-1.5">
            <label className={labelCls}>Script (written manually)</label>
            <textarea
              value={manualScript}
              onChange={(e) => setManualScript(e.target.value)}
              rows={10}
              placeholder="Write the script directly — this series isn't AI-generated."
              className={fieldCls}
            />
          </div>
        ) : (
          series.fields.map((field) => <FieldControl key={field.key} field={field} value={values[field.key]} onChange={(v) => setField(field.key, v)} />)
        )}

        {series.mode === "ai" && (
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-none bg-[#004c37] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#00614a] disabled:opacity-50"
          >
            {pending ? "Generating…" : "Generate script"}
          </button>
        )}
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

        {series.mode === "manual" ? (
          <div className="max-h-[560px] overflow-y-auto rounded-none border border-ink/10 bg-ink/5 p-4">
            <p className="whitespace-pre-wrap text-sm text-ink/80">
              {manualScript || "This series is written directly — type it on the left."}
            </p>
          </div>
        ) : !error && !script && !pending ? (
          <div className="rounded-none border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/40">
            Generated script will appear here and save to the Asset Library.
          </div>
        ) : script ? (
          <div className="space-y-2">
            <div className="max-h-[500px] overflow-y-auto rounded-none border border-ink/10 bg-ink/5 p-4">
              <p className="whitespace-pre-wrap text-sm text-ink/80">{script}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(script);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="w-full rounded-none border border-ink/15 bg-ink/8 px-3 py-2 text-xs text-ink/70 hover:bg-ink/15"
            >
              {copied ? "Copied ✓" : "Copy script"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldControl({ field, value, onChange }: { field: ScriptField; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === "repeat") {
    const items = (value as Record<string, unknown>[] | undefined) ?? [];
    const itemFields = field.fields;
    function updateItem(i: number, key: string, v: unknown) {
      const next = items.slice();
      next[i] = { ...next[i], [key]: v };
      onChange(next);
    }
    function addItem() {
      const blank: Record<string, unknown> = {};
      for (const f of itemFields) blank[f.key] = f.type === "select" ? f.default : "";
      onChange([...items, blank]);
    }
    function removeItem(i: number) {
      onChange(items.filter((_, idx) => idx !== i));
    }
    return (
      <div className="space-y-2">
        <label className={labelCls}>{field.label}</label>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="space-y-2 border border-ink/10 bg-ink/5 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wide text-ink/40">
                  {field.itemLabel} {i + 1}
                </span>
                <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-600 hover:text-red-700">
                  Remove
                </button>
              </div>
              {field.fields.map((sub) => (
                <FieldControl key={sub.key} field={sub} value={item[sub.key]} onChange={(v) => updateItem(i, sub.key, v)} />
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="w-full rounded-none border border-dashed border-ink/25 px-2.5 py-1.5 text-xs text-ink/60 hover:border-ink/40 hover:text-ink/90"
        >
          + Add {field.itemLabel.toLowerCase()}
        </button>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <label className={labelCls}>{field.label}</label>
        <select value={(value as string) ?? field.default} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1">
        <label className={labelCls}>{field.label}</label>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
          className={fieldCls}
        />
      </div>
    );
  }

  if (field.type === "range") {
    const current = (value as number | undefined) ?? field.default;
    return (
      <div className="space-y-1">
        <label className={labelCls}>
          {field.label} <span className="text-ink/40">({current}s)</span>
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
          placeholder={field.placeholder}
          value={(value as number | string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={fieldCls}
        />
      </div>
    );
  }

  // text
  return (
    <div className="space-y-1">
      <label className={labelCls}>{field.label}</label>
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={fieldCls}
      />
    </div>
  );
}
