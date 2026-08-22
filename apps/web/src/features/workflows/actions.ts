"use server";

import { revalidatePath } from "next/cache";
import { and, eq, notInArray, sql } from "drizzle-orm";
import {
  db,
  logAudit,
  one,
  runs,
  workflowEdges,
  workflowNodes,
  workflowPages,
  workflowVersions,
  workflows,
} from "@superos/db";
import { enqueueWorkflowRun } from "@superos/queue";
import { auth } from "@/lib/auth";
import { getRunWithSteps } from "./queries";

export interface CanvasNodeInput {
  id: string;
  type: string;
  title: string | null;
  positionX: number;
  positionY: number;
  width: number | null;
  height: number | null;
  dataJson: Record<string, unknown>;
}

export interface CanvasEdgeInput {
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  dataType: string;
}

export async function createWorkflowAction(name: string) {
  const session = await auth();
  const workflow = await one(
    db
      .insert(workflows)
      .values({ name: name.trim() || "Untitled workflow", createdBy: session?.user?.id ?? null })
      .returning(),
  );
  const version = await one(
    db
      .insert(workflowVersions)
      .values({ workflowId: workflow.id, versionNumber: 1, createdBy: session?.user?.id ?? null })
      .returning(),
  );
  const page = await one(
    db.insert(workflowPages).values({ workflowVersionId: version.id, name: "Page 1", orderIndex: 0 }).returning(),
  );
  await db.update(workflows).set({ latestVersionId: version.id }).where(eq(workflows.id, workflow.id));

  revalidatePath("/workflows");
  return { workflowId: workflow.id, versionId: version.id, pageId: page.id };
}

export async function createPageAction(workflowVersionId: string, name: string, orderIndex: number) {
  const page = await one(
    db.insert(workflowPages).values({ workflowVersionId, name: name.trim() || "Untitled page", orderIndex }).returning(),
  );
  revalidatePath("/workflows");
  return page;
}

export async function deletePageAction(pageId: string) {
  await db.delete(workflowPages).where(eq(workflowPages.id, pageId));
  revalidatePath("/workflows");
}

/**
 * Upserts nodes by client-stable id (so run history stays linked to the
 * same node across edits) and fully replaces edges for the page (edges have
 * no identity anything else references, so diffing them isn't worth it).
 */
export async function saveCanvasAction(
  pageId: string,
  workflowVersionId: string,
  nodes: CanvasNodeInput[],
  edges: CanvasEdgeInput[],
) {
  const nodeIds = nodes.map((n) => n.id);

  if (nodes.length > 0) {
    await db
      .insert(workflowNodes)
      .values(
        nodes.map((node) => ({
          id: node.id,
          workflowVersionId,
          pageId,
          type: node.type,
          title: node.title,
          positionX: node.positionX,
          positionY: node.positionY,
          width: node.width,
          height: node.height,
          dataJson: node.dataJson,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: workflowNodes.id,
        set: {
          title: sql`excluded.title`,
          positionX: sql`excluded.position_x`,
          positionY: sql`excluded.position_y`,
          width: sql`excluded.width`,
          height: sql`excluded.height`,
          dataJson: sql`excluded.data_json`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    // Scoped to this page only — never touch nodes belonging to other pages/workflows.
    await db.delete(workflowNodes).where(and(eq(workflowNodes.pageId, pageId), notInArray(workflowNodes.id, nodeIds)));
  } else {
    await db.delete(workflowNodes).where(eq(workflowNodes.pageId, pageId));
  }

  await db.delete(workflowEdges).where(eq(workflowEdges.pageId, pageId));
  if (edges.length > 0) {
    await db.insert(workflowEdges).values(
      edges.map((e) => ({
        workflowVersionId,
        pageId,
        sourceNodeId: e.sourceNodeId,
        sourcePort: e.sourcePort,
        targetNodeId: e.targetNodeId,
        targetPort: e.targetPort,
        dataType: e.dataType,
      })),
    );
  }

  const persistedEdges = await db.select().from(workflowEdges).where(eq(workflowEdges.pageId, pageId));
  return { edges: persistedEdges };
}

export type RunScope = "workflow_node" | "workflow_branch" | "workflow_full";

export async function runWorkflowAction(input: {
  workflowId: string;
  workflowVersionId: string;
  scope: RunScope;
  targetNodeId?: string;
  outputFolderId?: string | null;
}) {
  const session = await auth();
  const run = await one(
    db
      .insert(runs)
      .values({
        runScope: input.scope,
        status: "queued",
        workflowId: input.workflowId,
        workflowVersionId: input.workflowVersionId,
        targetNodeId: input.targetNodeId ?? null,
        initiatedBy: session?.user?.id ?? null,
        outputFolderId: input.outputFolderId ?? null,
      })
      .returning(),
  );

  await enqueueWorkflowRun(run.id);
  return { runId: run.id };
}

export async function pollWorkflowRunAction(runId: string) {
  return getRunWithSteps(runId);
}

export async function deleteWorkflowAction(workflowId: string) {
  await db.delete(workflows).where(eq(workflows.id, workflowId));
  const session = await auth();
  await logAudit({ actorId: session?.user?.id ?? null, action: "delete", entityType: "workflow", entityId: workflowId });
  revalidatePath("/workflows");
}

/** Full clone: new workflow, new version 1, and every page/node/edge copied with fresh ids. */
export async function duplicateWorkflowAction(workflowId: string) {
  const session = await auth();
  const [source] = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
  if (!source || !source.latestVersionId) throw new Error("Workflow not found");

  const [sourcePages, sourceNodes, sourceEdges] = await Promise.all([
    db.select().from(workflowPages).where(eq(workflowPages.workflowVersionId, source.latestVersionId)),
    db.select().from(workflowNodes).where(eq(workflowNodes.workflowVersionId, source.latestVersionId)),
    db.select().from(workflowEdges).where(eq(workflowEdges.workflowVersionId, source.latestVersionId)),
  ]);

  const newWorkflow = await one(
    db.insert(workflows).values({ name: `${source.name} (copy)`, description: source.description, createdBy: session?.user?.id ?? null }).returning(),
  );
  const newVersion = await one(
    db.insert(workflowVersions).values({ workflowId: newWorkflow.id, versionNumber: 1, createdBy: session?.user?.id ?? null }).returning(),
  );

  const pageIdMap = new Map<string, string>();
  for (const page of sourcePages) {
    const newPage = await one(
      db.insert(workflowPages).values({ workflowVersionId: newVersion.id, name: page.name, orderIndex: page.orderIndex }).returning(),
    );
    pageIdMap.set(page.id, newPage.id);
  }

  const nodeIdMap = new Map<string, string>();
  for (const node of sourceNodes) {
    const newPageId = pageIdMap.get(node.pageId);
    if (!newPageId) continue;
    const newNode = await one(
      db
        .insert(workflowNodes)
        .values({
          workflowVersionId: newVersion.id,
          pageId: newPageId,
          type: node.type,
          title: node.title,
          positionX: node.positionX,
          positionY: node.positionY,
          width: node.width,
          height: node.height,
          dataJson: node.dataJson,
        })
        .returning(),
    );
    nodeIdMap.set(node.id, newNode.id);
  }

  for (const edge of sourceEdges) {
    const newSource = nodeIdMap.get(edge.sourceNodeId);
    const newTarget = nodeIdMap.get(edge.targetNodeId);
    const newPageId = pageIdMap.get(edge.pageId);
    if (!newSource || !newTarget || !newPageId) continue;
    await db.insert(workflowEdges).values({
      workflowVersionId: newVersion.id,
      pageId: newPageId,
      sourceNodeId: newSource,
      sourcePort: edge.sourcePort,
      targetNodeId: newTarget,
      targetPort: edge.targetPort,
      dataType: edge.dataType,
    });
  }

  await db.update(workflows).set({ latestVersionId: newVersion.id }).where(eq(workflows.id, newWorkflow.id));
  await logAudit({
    actorId: session?.user?.id ?? null,
    action: "duplicate",
    entityType: "workflow",
    entityId: newWorkflow.id,
    metadata: { sourceWorkflowId: workflowId },
  });

  revalidatePath("/workflows");
  return { workflowId: newWorkflow.id };
}
