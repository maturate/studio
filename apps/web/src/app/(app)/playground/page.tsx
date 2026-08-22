import { MODEL_REGISTRY } from "@superos/model-registry";
import type { DataType } from "@superos/shared";
import { listAllFoldersFlat, getAsset } from "@/features/assets/queries";
import { getLatestPlaygroundRun } from "@/features/playground/queries";
import { resolveAttachmentsAction } from "@/features/playground/attachments";
import { PlaygroundForm, type PlaygroundSeed } from "@/features/playground/playground-form";
import { auth } from "@/lib/auth";

const DEFAULT_MODEL_ID = MODEL_REGISTRY.find((m) => m.category === "image" && m.status === "active")?.id ?? "";

interface AssetGenerationMetadata {
  modelId?: string;
  prompt?: string | null;
  settings?: Record<string, unknown>;
  referenceAssetIds?: string[];
}

async function resolveSeed(editAssetId?: string, remixAssetId?: string): Promise<PlaygroundSeed | null> {
  if (editAssetId) {
    const asset = await getAsset(editAssetId);
    if (!asset) return null;
    const meta = (asset.metadataJson as AssetGenerationMetadata | null) ?? {};
    const model = meta.modelId ? MODEL_REGISTRY.find((m) => m.id === meta.modelId) : undefined;
    // Only meaningful if the model that made this asset also accepts this asset's own type back as input.
    if (!model || !asset.downloadUrl || !model.inputTypes.includes(asset.type as DataType)) return null;
    return {
      action: "edit",
      modelId: model.id,
      prompt: "",
      settings: meta.settings ?? {},
      attachments: [{ assetId: asset.id, url: asset.downloadUrl, mimeType: asset.mimeType ?? "", type: asset.type, title: asset.title }],
    };
  }

  if (remixAssetId) {
    const asset = await getAsset(remixAssetId);
    if (!asset) return null;
    const meta = (asset.metadataJson as AssetGenerationMetadata | null) ?? {};
    const model = meta.modelId ? MODEL_REGISTRY.find((m) => m.id === meta.modelId) : undefined;
    if (!model) return null;
    const attachments = await resolveAttachmentsAction(meta.referenceAssetIds ?? []);
    return {
      action: "remix",
      modelId: model.id,
      prompt: meta.prompt ?? "",
      settings: meta.settings ?? {},
      attachments: attachments.map((a) => ({ assetId: a.assetId, url: a.url, mimeType: a.mimeType, type: a.type, title: a.title })),
    };
  }

  return null;
}

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ editAssetId?: string; remixAssetId?: string }>;
}) {
  const { editAssetId, remixAssetId } = await searchParams;
  const session = await auth();

  const seed = editAssetId || remixAssetId ? await resolveSeed(editAssetId, remixAssetId) : null;
  const initialModelId = seed?.modelId ?? DEFAULT_MODEL_ID;

  const [folders, latestRun] = await Promise.all([
    listAllFoldersFlat(),
    session?.user?.id && initialModelId && !seed
      ? getLatestPlaygroundRun(session.user.id, initialModelId)
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Fast one-off generation
        </h1>
      </div>
      <PlaygroundForm folders={folders} latestRun={latestRun} seed={seed} />
    </div>
  );
}
