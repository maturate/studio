"use server";

import { enqueueMediaRun } from "@superos/queue";
import { createQueuedPlaygroundRun, getRunStatus } from "@superos/workflow-engine";
import { MODEL_REGISTRY } from "@superos/model-registry";
import type { DataType } from "@superos/shared";
import { auth } from "@/lib/auth";
import { getAsset, getAssetPreviews } from "@/features/assets/queries";
import { getLatestPlaygroundRun } from "./queries";
import { resolveAttachmentsAction } from "./attachments";
import type { PlaygroundSeed } from "./playground-form";

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

interface AssetGenerationMetadata {
  modelId?: string;
  prompt?: string | null;
  settings?: Record<string, unknown>;
  referenceAssetIds?: string[];
}

/**
 * Shared by the Asset Library's Edit/Remix links (via ?editAssetId=/?remixAssetId=
 * on the Playground page) and the in-Playground Edit/Remix buttons on a just-
 * generated output — same reconstruction from the asset's own metadataJson
 * either way, so behavior never diverges between the two entry points.
 */
export async function resolveAssetSeedAction(assetId: string, action: "edit" | "remix"): Promise<PlaygroundSeed | null> {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    throw new Error("Not authorized");
  }

  const asset = await getAsset(assetId);
  if (!asset) return null;
  const meta = (asset.metadataJson as AssetGenerationMetadata | null) ?? {};
  const model = meta.modelId ? MODEL_REGISTRY.find((m) => m.id === meta.modelId) : undefined;
  if (!model) return null;

  if (action === "edit") {
    // Only meaningful if the model that made this asset also accepts this asset's own type back as input.
    if (!asset.downloadUrl || !model.inputTypes.includes(asset.type as DataType)) return null;
    return {
      action: "edit",
      modelId: model.id,
      prompt: "",
      settings: meta.settings ?? {},
      attachments: [{ assetId: asset.id, url: asset.downloadUrl, mimeType: asset.mimeType ?? "", type: asset.type, title: asset.title }],
    };
  }

  const attachments = await resolveAttachmentsAction(meta.referenceAssetIds ?? []);
  return {
    action: "remix",
    modelId: model.id,
    prompt: meta.prompt ?? "",
    settings: meta.settings ?? {},
    attachments: attachments.map((a) => ({ assetId: a.assetId, url: a.url, mimeType: a.mimeType, type: a.type, title: a.title })),
  };
}
