"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_DEFINITIONS, type DataType, type NodePortDefinition, type NodeType } from "@superos/shared";
import { MODEL_REGISTRY } from "@superos/model-registry";
import { ModelSettingsFields } from "@/features/shared/model-settings-fields";

const DATA_TYPE_COLORS: Record<DataType, string> = {
  text: "#60a5fa",
  image: "#f472b6",
  images: "#f472b6",
  audio: "#34d399",
  video: "#fbbf24",
  frames: "#fb923c",
  reference: "#a78bfa",
  character: "#e879f9",
  context: "#22d3ee",
  json: "#94a3b8",
  any: "#e5e7eb",
};

const DATA_TYPE_ICONS: Record<DataType, string> = {
  text: "🔤",
  image: "🖼️",
  images: "🖼️",
  audio: "🎵",
  video: "🎬",
  frames: "🎞️",
  reference: "🔗",
  character: "🧑‍🎤",
  context: "📚",
  json: "{ }",
  any: "•",
};

export interface GenericNodeData extends Record<string, unknown> {
  title: string | null;
  dataJson: Record<string, unknown>;
  folders: { id: string; name: string; depth: number }[];
  contextPacks: { id: string; name: string }[];
  onChange: (patch: { title?: string; dataJson?: Record<string, unknown> }) => void;
  onRun: () => void;
  runStatus?: "queued" | "running" | "succeeded" | "failed";
}

function PortRow({ port, side }: { port: NodePortDefinition; side: "input" | "output" }) {
  const color = DATA_TYPE_COLORS[port.dataType];
  return (
    <div className={`relative flex items-center gap-1.5 py-1 text-[10px] text-ink/60 ${side === "output" ? "flex-row-reverse text-right" : ""}`}>
      <Handle
        type={side === "input" ? "target" : "source"}
        position={side === "input" ? Position.Left : Position.Right}
        id={port.id}
        style={{ background: color, top: "50%" }}
        title={`${port.label} (${port.dataType})`}
      />
      <span aria-hidden>{DATA_TYPE_ICONS[port.dataType]}</span>
      <span className="truncate">{port.label}</span>
      {port.required && <span className="text-ink/30">*</span>}
    </div>
  );
}

export function GenericNode({ type, data, selected }: NodeProps & { data: GenericNodeData }) {
  const def = NODE_DEFINITIONS[type as NodeType];
  const dataJson = data.dataJson ?? {};

  function patchData(patch: Record<string, unknown>) {
    data.onChange({ dataJson: { ...dataJson, ...patch } });
  }

  if (!def) {
    return <div className="rounded-none border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-700">Unknown node type: {type}</div>;
  }

  const isNote = def.category === "note";
  const hasPorts = def.inputs.length > 0 || def.outputs.length > 0;

  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-none border bg-white shadow-lg ${
        selected ? "border-ink/40" : "border-ink/10"
      } ${isNote ? "bg-amber-500/10" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-3 py-2">
        <input
          value={data.title ?? def.label}
          onChange={(e) => data.onChange({ title: e.target.value })}
          className="w-full truncate bg-transparent text-xs font-medium text-ink/90 outline-none"
        />
        {data.runStatus && (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              data.runStatus === "running"
                ? "animate-pulse bg-blue-400"
                : data.runStatus === "succeeded"
                  ? "bg-emerald-400"
                  : data.runStatus === "failed"
                    ? "bg-red-600"
                    : "bg-ink/30"
            }`}
          />
        )}
      </div>

      {hasPorts && (
        <div className="grid grid-cols-2 gap-x-2 border-b border-ink/10 px-1 py-1">
          <div>
            {def.inputs.map((port) => (
              <PortRow key={port.id} port={port} side="input" />
            ))}
          </div>
          <div>
            {def.outputs.map((port) => (
              <PortRow key={port.id} port={port} side="output" />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 p-3 text-xs">
        <NodeBody type={type as NodeType} dataJson={dataJson} patchData={patchData} folders={data.folders} contextPacks={data.contextPacks} />
      </div>

      {def.standaloneCapable || def.inputs.length === 0 ? (
        <div className="border-t border-ink/10 px-3 py-1.5">
          <button
            type="button"
            onClick={data.onRun}
            className="w-full rounded-none bg-ink/8 px-2 py-1 text-[11px] text-ink/60 transition hover:bg-ink/15 hover:text-ink/90"
          >
            Run this node
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NodeBody({
  type,
  dataJson,
  patchData,
  folders,
  contextPacks,
}: {
  type: NodeType;
  dataJson: Record<string, unknown>;
  patchData: (patch: Record<string, unknown>) => void;
  folders: { id: string; name: string; depth: number }[];
  contextPacks: { id: string; name: string }[];
}) {
  const inputCls =
    "w-full rounded-none border border-ink/10 bg-white px-2 py-1 text-[11px] text-ink placeholder:text-ink/30 focus:border-ink/25 focus:outline-none nodrag";

  switch (type) {
    case "text_input":
      return (
        <textarea
          className={inputCls}
          rows={2}
          value={(dataJson.value as string) ?? ""}
          onChange={(e) => patchData({ value: e.target.value })}
          placeholder="Text value…"
        />
      );

    case "sticky_note":
    case "comment":
      return (
        <textarea
          className={`${inputCls} min-h-[80px]`}
          rows={4}
          value={(dataJson.text as string) ?? ""}
          onChange={(e) => patchData({ text: e.target.value })}
          placeholder="Note…"
        />
      );

    case "image_generator":
    case "audio_generator":
    case "video_generator": {
      const category = type === "image_generator" ? "image" : type === "audio_generator" ? "audio" : "video";
      const models = MODEL_REGISTRY.filter((m) => m.category === category);
      const modelId = (dataJson.modelId as string) ?? "";
      const settings = (dataJson.settings as Record<string, unknown>) ?? {};
      return (
        <div className="nodrag space-y-2">
          <select
            className={inputCls}
            value={modelId}
            onChange={(e) => patchData({ modelId: e.target.value })}
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <textarea
            className={inputCls}
            rows={2}
            value={(dataJson.prompt as string) ?? ""}
            onChange={(e) => patchData({ prompt: e.target.value })}
            placeholder="Prompt (used if no upstream prompt)…"
          />
          <p className="text-[10px] text-ink/35">
            Tag a wired reference by <code className="rounded-none bg-ink/10 px-1">@attachment-1</code>,{" "}
            <code className="rounded-none bg-ink/10 px-1">@attachment-2</code>… in port order (Reference, Character,
            Frames, Image, Video, Audio — only wired ones count). Resolved to that reference's real name before it
            reaches the model.
          </p>
          {modelId && (
            <div className="border-t border-ink/10 pt-2">
              <ModelSettingsFields
                modelId={modelId}
                settings={settings}
                onChange={(next) => patchData({ settings: next })}
                compact
              />
            </div>
          )}
        </div>
      );
    }

    case "prompt_template":
      return (
        <textarea
          className={inputCls}
          rows={3}
          value={(dataJson.template as string) ?? ""}
          onChange={(e) => patchData({ template: e.target.value })}
          placeholder="Hello {{name}}…"
        />
      );

    case "prompt_combiner":
      return (
        <input
          className={inputCls}
          value={(dataJson.separator as string) ?? " "}
          onChange={(e) => patchData({ separator: e.target.value })}
          placeholder="Separator"
        />
      );

    case "superos_context_search":
      return (
        <>
          <input
            className={inputCls}
            value={(dataJson.query as string) ?? ""}
            onChange={(e) => patchData({ query: e.target.value })}
            placeholder="Query (used if no upstream query)…"
          />
          <select
            className={inputCls}
            value={(dataJson.mode as string) ?? "suggested"}
            onChange={(e) => patchData({ mode: e.target.value })}
          >
            <option value="suggested">Suggested</option>
            <option value="agentic">Agentic</option>
            <option value="pinned">Pinned pack</option>
          </select>
          {dataJson.mode === "pinned" && (
            <select
              className={inputCls}
              value={(dataJson.contextPackId as string) ?? ""}
              onChange={(e) => patchData({ contextPackId: e.target.value })}
            >
              <option value="">Select pack…</option>
              {contextPacks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </>
      );

    case "context_pack":
      return (
        <select
          className={inputCls}
          value={(dataJson.contextPackId as string) ?? ""}
          onChange={(e) => patchData({ contextPackId: e.target.value })}
        >
          <option value="">Select pack…</option>
          {contextPacks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      );

    case "save_to_asset_library":
      return (
        <select
          className={inputCls}
          value={(dataJson.folderId as string) ?? ""}
          onChange={(e) => patchData({ folderId: e.target.value || undefined })}
        >
          <option value="">Asset Library (root)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {"—".repeat(f.depth)} {f.name}
            </option>
          ))}
        </select>
      );

    case "asset_input":
    case "reference_input":
    case "character_input": {
      const key = type === "asset_input" ? "assetId" : type === "reference_input" ? "referenceId" : "characterId";
      return (
        <input
          className={inputCls}
          value={(dataJson[key] as string) ?? ""}
          onChange={(e) => patchData({ [key]: e.target.value })}
          placeholder={`${key} (paste from library)`}
        />
      );
    }

    case "router":
      return (
        <select className={inputCls} value={(dataJson.route as string) ?? "a"} onChange={(e) => patchData({ route: e.target.value })}>
          <option value="a">Route to A</option>
          <option value="b">Route to B</option>
        </select>
      );

    case "list_batch":
      return (
        <textarea
          className={inputCls}
          rows={2}
          value={JSON.stringify(dataJson.items ?? [], null, 0)}
          onChange={(e) => {
            try {
              patchData({ items: JSON.parse(e.target.value) });
            } catch {
              /* ignore invalid JSON until it parses */
            }
          }}
          placeholder="[1, 2, 3]"
        />
      );

    default:
      return <p className="text-ink/40">{NODE_DEFINITIONS[type]?.description}</p>;
  }
}
