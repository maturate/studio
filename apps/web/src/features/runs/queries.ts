import { desc, eq } from "drizzle-orm";
import { db, runs, users, workflows } from "@superos/db";

export async function listRecentRuns(limit = 50) {
  const rows = await db
    .select({
      id: runs.id,
      runScope: runs.runScope,
      status: runs.status,
      workflowId: runs.workflowId,
      workflowName: workflows.name,
      estimatedCost: runs.estimatedCost,
      actualCost: runs.actualCost,
      startedAt: runs.startedAt,
      completedAt: runs.completedAt,
      failedAt: runs.failedAt,
      createdAt: runs.createdAt,
      initiatedByName: users.name,
      initiatedByEmail: users.email,
    })
    .from(runs)
    .leftJoin(workflows, eq(workflows.id, runs.workflowId))
    .leftJoin(users, eq(users.id, runs.initiatedBy))
    .orderBy(desc(runs.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, initiatedByDisplay: r.initiatedByName ?? r.initiatedByEmail ?? null }));
}
