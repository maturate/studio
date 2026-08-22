"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_DEFINITIONS, NODE_TYPES, type NodeType } from "@superos/shared";
import { GenericNode, type GenericNodeData } from "./generic-node";
import { Toolbar, type ToolMode } from "./toolbar";
import { RunPanel } from "./run-panel";
import { saveCanvasAction, runWorkflowAction, type CanvasEdgeInput, type CanvasNodeInput, type RunScope } from "../actions";

const nodeTypes = Object.fromEntries(NODE_TYPES.map((t) => [t, GenericNode]));

export interface WorkflowCanvasProps {
  workflowId: string;
  workflowVersionId: string;
  pageId: string;
  initialNodes: CanvasNodeInput[];
  initialEdges: CanvasEdgeInput[];
  folders: { id: string; name: string; depth: number }[];
  contextPacks: { id: string; name: string }[];
}

type FlowNode = Node<GenericNodeData>;
type FlowEdge = Edge<{ dataType: string }>;
type NodeDataPatch = { title?: string; dataJson?: Record<string, unknown> };

function toFlowNode(n: CanvasNodeInput, onChange: (patch: NodeDataPatch) => void, onRun: () => void): FlowNode {
  return {
    id: n.id,
    type: n.type,
    position: { x: n.positionX, y: n.positionY },
    data: { title: n.title, dataJson: n.dataJson, folders: [], contextPacks: [], onChange, onRun },
  };
}

function toFlowEdge(e: CanvasEdgeInput): FlowEdge {
  return {
    id: `${e.sourceNodeId}:${e.sourcePort}->${e.targetNodeId}:${e.targetPort}`,
    source: e.sourceNodeId,
    sourceHandle: e.sourcePort,
    target: e.targetNodeId,
    targetHandle: e.targetPort,
    data: { dataType: e.dataType },
  };
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowCanvasInner({
  workflowId,
  workflowVersionId,
  pageId,
  initialNodes,
  initialEdges,
  folders,
  contextPacks,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(
    initialNodes.map((n) => toFlowNode(n, () => {}, () => {})),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialEdges.map(toFlowEdge));
  const [tool, setTool] = useState<ToolMode>("select");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const historyRef = useRef<{ past: { nodes: FlowNode[]; edges: FlowEdge[] }[]; future: { nodes: FlowNode[]; edges: FlowEdge[] }[] }>({
    past: [],
    future: [],
  });
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) return;
    historyRef.current.past.push({ nodes, edges });
    historyRef.current.future = [];
  }, [nodes, edges]);

  function undo() {
    const prev = historyRef.current.past.pop();
    if (!prev) return;
    historyRef.current.future.push({ nodes, edges });
    skipHistoryRef.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    skipHistoryRef.current = false;
  }

  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push({ nodes, edges });
    skipHistoryRef.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    skipHistoryRef.current = false;
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  function updateNodeData(nodeId: string, patch: NodeDataPatch) {
    pushHistory();
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }

  function runNode(nodeId: string, scope: RunScope) {
    startRun(scope, nodeId);
  }

  // Re-bind callbacks now that updateNodeData/runNode exist (avoids stale closures from initial mount).
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onChange: (patch: NodeDataPatch) => updateNodeData(n.id, patch),
          onRun: () => runNode(n.id, "workflow_node"),
          folders,
          contextPacks,
        },
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;
      const sourceDef = NODE_DEFINITIONS[sourceNode.type as NodeType];
      const targetDef = NODE_DEFINITIONS[targetNode.type as NodeType];
      const outPort = sourceDef?.outputs.find((p) => p.id === connection.sourceHandle);
      const inPort = targetDef?.inputs.find((p) => p.id === connection.targetHandle);
      if (!outPort || !inPort) return;
      if (outPort.dataType !== "any" && inPort.dataType !== "any" && outPort.dataType !== inPort.dataType) {
        return; // incompatible port types
      }
      pushHistory();
      setEdges((eds) => addEdge({ ...connection, data: { dataType: outPort.dataType } }, eds));
    },
    [nodes, pushHistory, setEdges],
  );

  function onEdgeClick(_: React.MouseEvent, edge: FlowEdge) {
    if (tool !== "cut") return;
    pushHistory();
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }

  function addNode(type: NodeType) {
    pushHistory();
    const id = crypto.randomUUID();
    const position = { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 };
    const newNode: FlowNode = {
      id,
      type,
      position,
      data: {
        title: NODE_DEFINITIONS[type].label,
        dataJson: {},
        onChange: (patch: NodeDataPatch) => updateNodeData(id, patch),
        onRun: () => runNode(id, "workflow_node"),
        folders,
        contextPacks,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }

  async function save() {
    setSaving(true);
    try {
      const nodePayload: CanvasNodeInput[] = nodes.map((n) => ({
        id: n.id,
        type: n.type!,
        title: n.data.title ?? null,
        positionX: n.position.x,
        positionY: n.position.y,
        width: n.measured?.width ?? null,
        height: n.measured?.height ?? null,
        dataJson: n.data.dataJson ?? {},
      }));
      const edgePayload: CanvasEdgeInput[] = edges.map((e) => ({
        sourceNodeId: e.source,
        sourcePort: e.sourceHandle ?? "value",
        targetNodeId: e.target,
        targetPort: e.targetHandle ?? "value",
        dataType: e.data?.dataType ?? "any",
      }));
      await saveCanvasAction(pageId, workflowVersionId, nodePayload, edgePayload);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function startRun(scope: RunScope, targetNodeId?: string) {
    await save();
    const { runId } = await runWorkflowAction({ workflowId, workflowVersionId, scope, targetNodeId });
    setActiveRunId(runId);
  }

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onAddNode={addNode}
        onUndo={undo}
        onRedo={redo}
        onSave={save}
        saving={saving}
        savedAt={savedAt}
        selectedNode={selectedNode}
        onRunNode={() => selectedNodeId && startRun("workflow_node", selectedNodeId)}
        onRunFromHere={() => selectedNodeId && startRun("workflow_branch", selectedNodeId)}
        onRunAll={() => startRun("workflow_full")}
      />

      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          panOnDrag={tool === "hand" ? true : [1]}
          selectionOnDrag={tool === "select"}
          nodesDraggable={tool !== "cut"}
          onSelectionChange={({ nodes: sel }) => setSelectedNodeId(sel[0]?.id ?? null)}
          colorMode="light"
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable className="!bg-ink/5" />
        </ReactFlow>

        {activeRunId && <RunPanel runId={activeRunId} onClose={() => setActiveRunId(null)} />}
      </div>
    </div>
  );
}
