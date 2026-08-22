import { auditLogs } from "./schema";
import { db } from "./client";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget audit write — never let logging failure block the actual operation. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadataJson: entry.metadata ?? {},
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
