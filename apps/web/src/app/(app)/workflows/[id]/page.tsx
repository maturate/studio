import { notFound } from "next/navigation";
import { listContextPacks } from "@superos/context-engine";
import { getWorkflow, listEdgesForPage, listNodesForPage, listPages } from "@/features/workflows/queries";
import { listAllFoldersFlat } from "@/features/assets/queries";
import { PageTabs } from "@/features/workflows/components/page-tabs";
import { WorkflowCanvas } from "@/features/workflows/components/workflow-canvas";

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;

  const workflow = await getWorkflow(id);
  if (!workflow || !workflow.latestVersionId) notFound();

  const pages = await listPages(workflow.latestVersionId);
  if (pages.length === 0) notFound();
  const activePage = pages.find((p) => p.id === pageParam) ?? pages[0]!;

  const [nodes, edges, folders, contextPacks] = await Promise.all([
    listNodesForPage(activePage.id),
    listEdgesForPage(activePage.id),
    listAllFoldersFlat(),
    listContextPacks(),
  ]);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
        <h1 className="text-sm font-medium text-ink/85">{workflow.name}</h1>
      </div>
      <PageTabs workflowId={workflow.id} workflowVersionId={workflow.latestVersionId} pages={pages} activePageId={activePage.id} />
      <div className="min-h-0 flex-1">
        <WorkflowCanvas
          workflowId={workflow.id}
          workflowVersionId={workflow.latestVersionId}
          pageId={activePage.id}
          initialNodes={nodes.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            positionX: n.positionX,
            positionY: n.positionY,
            width: n.width,
            height: n.height,
            dataJson: (n.dataJson as Record<string, unknown>) ?? {},
          }))}
          initialEdges={edges.map((e) => ({
            sourceNodeId: e.sourceNodeId,
            sourcePort: e.sourcePort,
            targetNodeId: e.targetNodeId,
            targetPort: e.targetPort,
            dataType: e.dataType,
          }))}
          folders={folders}
          contextPacks={contextPacks.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  );
}
