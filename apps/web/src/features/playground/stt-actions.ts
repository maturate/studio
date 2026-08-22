"use server";

import { enqueueMediaRun } from "@superos/queue";
import { createQueuedSttRun, getSttRunStatus } from "@superos/workflow-engine";
import { auth } from "@/lib/auth";

export async function enqueueSttRunAction(sourceUrl: string, summaryWords: number): Promise<{ runId: string }> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }
  const runId = await createQueuedSttRun({ sourceUrl, userId: session.user.id, summaryWords });
  await enqueueMediaRun(runId);
  return { runId };
}

export async function pollSttRunStatusAction(runId: string) {
  return getSttRunStatus(runId);
}
