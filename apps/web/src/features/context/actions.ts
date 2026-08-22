"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@superos/db";
import { createContextPack, deleteContextPack, ingestSuperOSDocs } from "@superos/context-engine";
import { auth } from "@/lib/auth";

export async function syncSuperOSDocsAction() {
  const results = await ingestSuperOSDocs();
  revalidatePath("/settings/context");
  return {
    total: results.length,
    ingested: results.filter((r) => !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    chunks: results.reduce((sum, r) => sum + r.chunkCount, 0),
  };
}

export async function createContextPackAction(input: { name: string; description: string; pinnedSourceRefs: string[] }) {
  await createContextPack(input);
  revalidatePath("/settings/context");
}

export async function deleteContextPackAction(id: string) {
  await deleteContextPack(id);
  const session = await auth();
  await logAudit({ actorId: session?.user?.id ?? null, action: "delete", entityType: "context_pack", entityId: id });
  revalidatePath("/settings/context");
}
