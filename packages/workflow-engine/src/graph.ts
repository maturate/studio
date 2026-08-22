export interface GraphEdge {
  sourceNodeId: string;
  targetNodeId: string;
}

/** All node ids reachable forward from `startNodeId`, start node included. */
export function downstreamSubgraph(startNodeId: string, edges: GraphEdge[]): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, list);
  }

  const visited = new Set<string>([startNodeId]);
  const queue = [startNodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/**
 * Kahn's-algorithm topological sort, restricted to `nodeIds`. Throws on a
 * cycle rather than silently truncating — a cyclic workflow graph is a
 * genuine authoring error the operator needs to see, not paper over.
 */
export function topoSort(nodeIds: Set<string>, edges: GraphEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) inDegree.set(id, 0);

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) continue;
    const list = adjacency.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, list);
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const queue = [...nodeIds].filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const remaining = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (order.length !== nodeIds.size) {
    throw new Error("Workflow graph contains a cycle — cannot determine execution order");
  }

  return order;
}
