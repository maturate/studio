import Link from "next/link";
import { auth } from "@/lib/auth";
import { MODEL_REGISTRY } from "@superos/model-registry";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Account & registry</h1>
      </div>

      <section className="rounded-none border border-ink/10 bg-ink/5 p-6">
        <h2 className="text-sm font-medium font-mono uppercase tracking-[0.15em] text-ink/50">
          Signed in as
        </h2>
        <div className="mt-3 space-y-1 text-sm text-ink/80">
          <p>{session?.user?.name}</p>
          <p className="text-ink/50">{session?.user?.email}</p>
          <p className="text-ink/50">Role: {session?.user?.role}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium font-mono uppercase tracking-[0.15em] text-ink/50">
            Model registry
          </h2>
          <p className="mt-1 text-sm text-ink/55">
            Shared across Playground and Workflow. Scope is intentionally limited to
            production-approved tooling — see AGENTS.md §5.3A.
          </p>
        </div>

        <div className="overflow-hidden rounded-none border border-ink/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/5 text-xs font-mono uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Pricing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MODEL_REGISTRY.map((model) => (
                <tr key={model.id}>
                  <td className="px-4 py-3">
                    <div className="text-ink/90">{model.label}</div>
                    <div className="font-mono text-xs text-ink/40">{model.id}</div>
                  </td>
                  <td className="px-4 py-3 text-ink/60">{model.provider}</td>
                  <td className="px-4 py-3 text-ink/60 capitalize">{model.category}</td>
                  <td className="px-4 py-3 text-ink/40">
                    {model.pricing.verified ? model.pricing.unit : "unverified"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-none border border-ink/10 bg-ink/5 p-6">
        <div>
          <h2 className="text-sm font-medium font-mono uppercase tracking-[0.15em] text-ink/50">superOS context</h2>
          <p className="mt-1 text-sm text-ink/55">Knowledge base ingestion, retrieval, and context packs.</p>
        </div>
        <Link
          href="/settings/context"
          className="rounded-none border border-ink/15 bg-ink/8 px-3 py-2 text-sm text-ink/85 hover:bg-ink/15"
        >
          Manage →
        </Link>
      </section>
    </div>
  );
}
