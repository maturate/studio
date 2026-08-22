import { asc, eq } from "drizzle-orm";
import { contextPacks, db, one } from "@superos/db";
import { retrieveFromSources, type RetrievedChunk } from "./retrieve";

export async function listContextPacks() {
  return db.select().from(contextPacks).orderBy(asc(contextPacks.name));
}

export async function getContextPack(id: string) {
  const [pack] = await db.select().from(contextPacks).where(eq(contextPacks.id, id)).limit(1);
  return pack ?? null;
}

export async function createContextPack(input: {
  name: string;
  description?: string;
  pinnedSourceRefs: string[];
}) {
  return one(
    db
      .insert(contextPacks)
      .values({
        name: input.name,
        description: input.description,
        pinnedSourcesJson: input.pinnedSourceRefs,
        selectionRulesJson: {},
      })
      .returning(),
  );
}

export async function deleteContextPack(id: string) {
  await db.delete(contextPacks).where(eq(contextPacks.id, id));
}

/** Resolves a pinned pack's context for a specific query, for run-time attribution. */
export async function resolvePinnedContext(
  packId: string,
  query: string,
  topK = 8,
): Promise<RetrievedChunk[]> {
  const pack = await getContextPack(packId);
  if (!pack) throw new Error(`Context pack not found: ${packId}`);
  const sourceRefs = (pack.pinnedSourcesJson as string[]) ?? [];
  return retrieveFromSources(query, sourceRefs, topK);
}
