import { listContextPacks, listKnowledgeSources } from "@superos/context-engine";
import { SyncButton } from "@/features/context/sync-button";
import { ContextPackForm } from "@/features/context/context-pack-form";
import { DeletePackButton } from "@/features/context/delete-pack-button";

export default async function ContextSettingsPage() {
  const [sources, packs] = await Promise.all([listKnowledgeSources(), listContextPacks()]);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">superOS context</h1>
        <p className="text-sm text-ink/55">
          Repo/doc ingestion, semantic retrieval, and pinned context packs — see AGENTS.md §11. Requires
          GOOGLE_GENERATIVE_AI_API_KEY for embeddings.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium font-mono uppercase tracking-[0.15em] text-ink/50">Knowledge sources</h2>
          <SyncButton />
        </div>
        <div className="overflow-hidden rounded-none border border-ink/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/5 text-xs font-mono uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Chunks</th>
                <th className="px-4 py-3 font-medium">Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sources.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink/35">
                    No sources ingested yet.
                  </td>
                </tr>
              )}
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-ink/85">{s.title}</td>
                  <td className="px-4 py-3 text-ink/50">{s.sourceType}</td>
                  <td className="px-4 py-3 text-ink/50">{s.chunkCount}</td>
                  <td className="px-4 py-3 text-ink/40">{s.syncedAt ? new Date(s.syncedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium font-mono uppercase tracking-[0.15em] text-ink/50">Context packs</h2>
        <div className="space-y-2">
          {packs.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-none border border-ink/10 bg-ink/5 px-4 py-3">
              <div>
                <p className="text-sm text-ink/85">{p.name}</p>
                <p className="text-xs text-ink/45">{(p.pinnedSourcesJson as string[])?.length ?? 0} pinned sources</p>
              </div>
              <DeletePackButton id={p.id} name={p.name} />
            </div>
          ))}
        </div>
        <ContextPackForm sourceRefs={sources.map((s) => ({ ref: s.sourceRef, title: s.title }))} />
      </section>
    </div>
  );
}
