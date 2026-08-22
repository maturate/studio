import Link from "next/link";
import type { AssetType } from "@superos/shared";
import { getFolderBreadcrumb, getPendingRunsForFolder, listAllFoldersFlat, listAssets, listChildFolders } from "@/features/assets/queries";
import { AssetToolbar } from "@/features/assets/components/toolbar";
import { NewFolderButton } from "@/features/assets/components/new-folder-button";
import { UploadButton } from "@/features/assets/components/upload-button";
import { FolderTile } from "@/features/assets/components/folder-tile";
import { AssetCard } from "@/features/assets/components/asset-card";
import { PendingGenerationTiles } from "@/features/assets/components/pending-generation-tiles";

export default async function AssetLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; type?: string; q?: string }>;
}) {
  const { folder, type, q } = await searchParams;
  const folderId = folder ?? null;

  const [breadcrumb, childFolders, assetRows, pendingRuns, allFolders] = await Promise.all([
    getFolderBreadcrumb(folderId),
    listChildFolders(folderId),
    listAssets({ folderId, type: (type as AssetType) || undefined, query: q }),
    getPendingRunsForFolder(folderId),
    listAllFoldersFlat(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <nav className="flex items-center gap-1.5 text-sm text-ink/60">
            <Link href="/assets" className="hover:text-ink/90">
              Library
            </Link>
            {breadcrumb.map((crumb) => (
              <span key={crumb.id} className="flex items-center gap-1.5">
                <span className="text-ink/30">/</span>
                <Link href={`/assets?folder=${crumb.id}`} className="hover:text-ink/90">
                  {crumb.name}
                </Link>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <NewFolderButton parentId={folderId} />
          <UploadButton folderId={folderId} />
        </div>
      </div>

      <AssetToolbar folderId={folderId} query={q ?? ""} type={type ?? ""} />

      {childFolders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium font-mono uppercase tracking-[0.15em] text-ink/40">Folders</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {childFolders.map((f) => (
              <FolderTile key={f.id} id={f.id} name={f.name} folders={allFolders} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-medium font-mono uppercase tracking-[0.15em] text-ink/40">
          Assets {assetRows.length > 0 && `(${assetRows.length})`}
        </h2>

        {assetRows.length === 0 && pendingRuns.length === 0 ? (
          <div className="rounded-none border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/45">
            No assets here yet. Upload a file or generate one from Playground later.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <PendingGenerationTiles runs={pendingRuns} />
            {assetRows.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={{
                  id: asset.id,
                  title: asset.title,
                  type: asset.type,
                  mimeType: asset.mimeType,
                  previewUrl: asset.previewUrl,
                  downloadUrl: asset.downloadUrl,
                  createdAt: asset.createdAt,
                  sourceKind: asset.sourceKind,
                  metadataJson: asset.metadataJson,
                  folderId: asset.folderId,
                  creatorName: asset.creatorName,
                }}
                folders={allFolders}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
