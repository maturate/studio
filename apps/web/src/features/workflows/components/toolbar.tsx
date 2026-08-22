"use client";

import { useState } from "react";
import type { Node } from "@xyflow/react";
import { NODE_CATEGORIES, NODE_DEFINITIONS, NODE_TYPES, type NodeCategory, type NodeType } from "@superos/shared";

export type ToolMode = "select" | "hand" | "cut";

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: "Input",
  generation: "Generation",
  transform: "Transform",
  context: "Context",
  reference: "Reference",
  utility: "Utility",
  output: "Output",
  note: "Canvas",
};

export function Toolbar({
  tool,
  onToolChange,
  onAddNode,
  onUndo,
  onRedo,
  onSave,
  saving,
  savedAt,
  selectedNode,
  onRunNode,
  onRunFromHere,
  onRunAll,
}: {
  tool: ToolMode;
  onToolChange: (t: ToolMode) => void;
  onAddNode: (type: NodeType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  saving: boolean;
  savedAt: Date | null;
  selectedNode: Node | null;
  onRunNode: () => void;
  onRunFromHere: () => void;
  onRunAll: () => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/10 bg-white px-4 py-2">
      <div className="flex items-center gap-1">
        <ToolButton active={tool === "select"} onClick={() => onToolChange("select")} label="Select">
          ⬚
        </ToolButton>
        <ToolButton active={tool === "hand"} onClick={() => onToolChange("hand")} label="Pan">
          ✋
        </ToolButton>
        <ToolButton active={tool === "cut"} onClick={() => onToolChange("cut")} label="Cut edges — click an edge to remove it">
          ✂︎
        </ToolButton>

        <div className="relative">
          <ToolButton active={paletteOpen} onClick={() => setPaletteOpen((o) => !o)} label="Add node">
            ＋
          </ToolButton>
          {paletteOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-96 w-64 overflow-y-auto rounded-none border border-ink/10 bg-white p-2 shadow-xl">
              {NODE_CATEGORIES.map((category) => (
                <div key={category} className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-medium font-mono uppercase tracking-wide text-ink/40">
                    {CATEGORY_LABELS[category]}
                  </p>
                  {NODE_TYPES.filter((t) => NODE_DEFINITIONS[t].category === category).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onAddNode(t);
                        setPaletteOpen(false);
                      }}
                      className="block w-full rounded-none px-2 py-1.5 text-left text-xs text-ink/80 hover:bg-ink/10"
                    >
                      {NODE_DEFINITIONS[t].label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-px bg-ink/10" />

        <ToolButton onClick={onUndo} label="Undo (Cmd+Z)">
          ↶
        </ToolButton>
        <ToolButton onClick={onRedo} label="Redo (Cmd+Shift+Z)">
          ↷
        </ToolButton>
      </div>

      <div className="flex items-center gap-2">
        {savedAt && <span className="text-[11px] text-ink/35">Saved {savedAt.toLocaleTimeString()}</span>}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-none border border-ink/10 bg-ink/8 px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:bg-ink/15 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {selectedNode && (
          <>
            <button
              type="button"
              onClick={onRunNode}
              className="rounded-none border border-ink/10 bg-ink/8 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/15"
            >
              Run this node
            </button>
            <button
              type="button"
              onClick={onRunFromHere}
              className="rounded-none border border-ink/10 bg-ink/8 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/15"
            >
              Run from here
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onRunAll}
          className="rounded-none bg-[#004c37] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00614a]"
        >
          Run connected workflow
        </button>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-none text-sm transition ${
        active ? "bg-[#004c37] text-white" : "text-ink/60 hover:bg-ink/10 hover:text-ink/90"
      }`}
    >
      {children}
    </button>
  );
}
