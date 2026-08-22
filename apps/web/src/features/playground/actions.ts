"use server";

import { enqueueMediaRun } from "@superos/queue";
import { createQueuedPlaygroundRun, getRunStatus } from "@superos/workflow-engine";
import { auth } from "@/lib/auth";
import { getAssetPreviews } from "@/features/assets/queries";
import { getLatestPlaygroundRun } from "./queries";

export interface GenerateFormInput {
  modelId: string;
  prompt: string;
  settings?: Record<string, unknown>;
  folderId: string | null;
  attachments?: { assetId: string; url: string; mimeType: string }[];
}

export async function enqueueGenerationAction(input: GenerateFormInput): Promise<{ runId: string }> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }

  const runId = await createQueuedPlaygroundRun({
    modelId: input.modelId,
    prompt: input.prompt,
    settings: input.settings ?? {},
    folderId: input.folderId,
    userId: session.user.id,
    references: input.attachments?.map((a) => ({ url: a.url, mimeType: a.mimeType })),
    referenceAssetIds: input.attachments?.map((a) => a.assetId),
  });

  await enqueueMediaRun(runId);
  return { runId };
}

export async function pollRunStatusAction(runId: string) {
  return getRunStatus(runId);
}

export async function getRunOutputPreviewsAction(assetIds: string[]) {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }
  return getAssetPreviews(assetIds);
}

export async function getLatestRunForModelAction(modelId: string) {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }
  return getLatestPlaygroundRun(session.user.id, modelId);
}
