import Link from "next/link";
import { listRecentRuns } from "@/features/runs/queries";

const STATUS_COLOR: Record<string, string> = {
  succeeded: "text-emerald-400",
  failed: "text-red-600",
  running: "text-blue-400",
  queued: "text-ink/50",
};

export default async function RunsPage() {
  const runRows = await listRecentRuns();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Recent activity</h1>
      </div>

      <div className="overflow-x-auto rounded-none border border-ink/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-ink/5 text-xs font-mono uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Run by</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {runRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/35">
                  No runs yet.
                </td>
              </tr>
            )}
            {runRows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-ink/70">{r.runScope}</td>
                <td className="px-4 py-3 text-ink/70">
                  {r.workflowId ? (
                    <Link href={`/workflows/${r.workflowId}`} className="hover:text-ink/95">
                      {r.workflowName ?? r.workflowId.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`px-4 py-3 ${STATUS_COLOR[r.status] ?? "text-ink/50"}`}>{r.status}</td>
                <td className="px-4 py-3 text-ink/70">{r.initiatedByDisplay ?? "—"}</td>
                <td className="px-4 py-3 text-ink/40">
                  {r.actualCost != null ? `$${r.actualCost.toFixed(3)}` : r.estimatedCost != null ? `~$${r.estimatedCost.toFixed(3)}` : "—"}
                </td>
                <td className="px-4 py-3 text-ink/40">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
