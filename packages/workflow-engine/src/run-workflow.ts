import { eq } from "drizzle-orm";
import { db, one, runs, runSteps, workflowEdges, workflowNodes } from "@superos/db";
import { NODE_DEFINITIONS, type NodeType } from "@superos/shared";
import { downstreamSubgraph, topoSort } from "./graph";
import { executeNode } from "./node-runner";
import type { ResolvedValue } from "./resolve";

/**
 * Executes a queued run against its workflow version's node/edge graph.
 * Called from the BullMQ worker (workers/workflow) — never from a request
 * thread, per AGENTS.md hard rule 3.
 */
export async function runWorkflow(runId: string): Promise<void> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error(`Run not found: ${runId}`);
  if (!run.workflowVersionId) throw new Error(`Run ${runId} has no workflow version`);

  const [nodesRaw, edgesRaw] = await Promise.all([
    db.select().from(workflowNodes).where(eq(workflowNodes.workflowVersionId, run.workflowVersionId)),
    db.select().from(workflowEdges).where(eq(workflowEdges.workflowVersionId, run.workflowVersionId)),
  ]);

  let targetNodeIds: Set<string>;
  if (run.runScope === "workflow_node") {
    if (!run.targetNodeId) throw new Error("Run scope 'workflow_node' requires a target node");
    targetNodeIds = new Set([run.targetNodeId]);
  } else if (run.runScope === "workflow_branch") {
    if (!run.targetNodeId) throw new Error("Run scope 'workflow_branch' requires a target node");
    targetNodeIds = downstreamSubgraph(run.targetNodeId, edgesRaw);
  } else {
    targetNodeIds = new Set(nodesRaw.map((n) => n.id));
  }

  // Note/comment nodes are canvas annotations, not executable steps.
  const runnableIds = new Set(
    [...targetNodeIds].filter((id) => {
      const node = nodesRaw.find((n) => n.id === id);
      return node && node.type !== "sticky_note" && node.type !== "comment";
    }),
  );

  const order = topoSort(runnableIds, edgesRaw);
  const outputsByNode = new Map<string, Record<string, ResolvedValue>>();

  await db.update(runs).set({ status: "running", startedAt: new Date() }).where(eq(runs.id, runId));

  let failed = false;

  for (const nodeId of order) {
    const node = nodesRaw.find((n) => n.id === nodeId);
    if (!node) continue;

    const definition = NODE_DEFINITIONS[node.type as NodeType] as
      | (typeof NODE_DEFINITIONS)[NodeType]
      | undefined;
    const inputs: Record<string, ResolvedValue | undefined> = {};
    for (const port of definition?.inputs ?? []) {
      const edge = edgesRaw.find((e) => e.targetNodeId === nodeId && e.targetPort === port.id);
      if (edge) {
        inputs[port.id] = outputsByNode.get(edge.sourceNodeId)?.[edge.sourcePort];
      }
    }

    const step = await one(
      db
        .insert(runSteps)
        .values({
          runId,
          nodeId,
          status: "running",
          inputSnapshotJson: inputs,
          settingsSnapshotJson: (node.dataJson as Record<string, unknown>) ?? {},
          startedAt: new Date(),
        })
        .returning(),
    );

    try {
      const result = await executeNode(
        { id: node.id, type: node.type, dataJson: (node.dataJson as Record<string, unknown>) ?? {} },
        inputs,
        { runId, userId: run.initiatedBy, defaultFolderId: run.outputFolderId },
      );
      outputsByNode.set(nodeId, result.outputs);

      await db
        .update(runSteps)
        .set({
          status: "succeeded",
          outputSnapshotJson: { outputs: result.outputs, assetIds: result.assetIds, note: result.note ?? null },
          completedAt: new Date(),
        })
        .where(eq(runSteps.id, step.id));
    } catch (err) {
      failed = true;
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(runSteps)
        .set({ status: "failed", logsJson: [{ level: "error", message }], completedAt: new Date() })
        .where(eq(runSteps.id, step.id));
      break; // Halt on first failure rather than executing downstream nodes on bad/missing input.
    }
  }

  await db
    .update(runs)
    .set({
      status: failed ? "failed" : "succeeded",
      completedAt: new Date(),
      failedAt: failed ? new Date() : null,
    })
    .where(eq(runs.id, runId));
}
