import { asc, desc, eq } from "drizzle-orm";
import { db, runSteps, runs, workflowEdges, workflowNodes, workflowPages, workflowVersions, workflows } from "@superos/db";

export async function listWorkflows() {
  return db.select().from(workflows).orderBy(desc(workflows.updatedAt));
}

export async function getWorkflow(id: string) {
  const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  return workflow ?? null;
}

export async function getWorkflowVersion(versionId: string) {
  const [version] = await db.select().from(workflowVersions).where(eq(workflowVersions.id, versionId)).limit(1);
  return version ?? null;
}

export async function listPages(workflowVersionId: string) {
  return db
    .select()
    .from(workflowPages)
    .where(eq(workflowPages.workflowVersionId, workflowVersionId))
    .orderBy(asc(workflowPages.orderIndex));
}

export async function listNodesForPage(pageId: string) {
  return db.select().from(workflowNodes).where(eq(workflowNodes.pageId, pageId));
}

export async function listEdgesForPage(pageId: string) {
  return db.select().from(workflowEdges).where(eq(workflowEdges.pageId, pageId));
}

export async function listRunsForWorkflow(workflowId: string) {
  return db.select().from(runs).where(eq(runs.workflowId, workflowId)).orderBy(desc(runs.createdAt)).limit(20);
}

export async function getRunWithSteps(runId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) return null;
  const steps = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(asc(runSteps.startedAt));
  return { run, steps };
}
