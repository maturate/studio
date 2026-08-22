import { listWorkflows } from "@/features/workflows/queries";
import { NewWorkflowButton } from "@/features/workflows/components/new-workflow-button";
import { WorkflowRowActions } from "@/features/workflows/components/workflow-row-actions";
import Link from "next/link";

export default async function WorkflowsPage() {
  const workflowRows = await listWorkflows();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Multi-canvas node editor</h1>
        </div>
        <NewWorkflowButton />
      </div>

      {workflowRows.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/45">
          No workflows yet. Create one to open the canvas.
        </div>
      ) : (
        <div className="divide-y divide-white/10 rounded-none border border-ink/10 bg-ink/5">
          {workflowRows.map((w) => (
            <div key={w.id} className="flex items-center justify-between px-4 py-3 text-sm transition hover:bg-ink/5">
              <Link href={`/workflows/${w.id}`} className="flex-1">
                <p className="text-ink/90">{w.name}</p>
                {w.description && <p className="text-xs text-ink/45">{w.description}</p>}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-wide text-ink/40">{w.status}</span>
                <WorkflowRowActions workflowId={w.id} name={w.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
