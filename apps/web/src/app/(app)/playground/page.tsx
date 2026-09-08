import { MODEL_REGISTRY } from "@superos/model-registry";
import { listAllFoldersFlat } from "@/features/assets/queries";
import { getLatestPlaygroundRun } from "@/features/playground/queries";
import { resolveAssetSeedAction } from "@/features/playground/actions";
import { PlaygroundForm, type PlaygroundSeed } from "@/features/playground/playground-form";
import { auth } from "@/lib/auth";

const DEFAULT_MODEL_ID = MODEL_REGISTRY.find((m) => m.category === "image" && m.status === "active")?.id ?? "";

async function resolveSeed(editAssetId?: string, remixAssetId?: string): Promise<PlaygroundSeed | null> {
  if (editAssetId) return resolveAssetSeedAction(editAssetId, "edit");
  if (remixAssetId) return resolveAssetSeedAction(remixAssetId, "remix");
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
