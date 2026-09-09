import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { assets, characters, db, one, references } from "@superos/db";
import { estimateCost, getModelById } from "@superos/model-registry";
import { buildAssetStorageKey, createDownloadUrl, putObject } from "@superos/storage";
import {
  getChunksForSourceRefs,
  getContextPack,
  retrieveContext,
  retrieveContextAgentic,
  resolvePinnedContext,
} from "@superos/context-engine";
import { getGenerationAdapter } from "./generation/registry";
import { geminiGenerateText } from "./generation/providers/google";
import {
  collectReferences,
  resolvedValueToContextText,
  resolvedValueToText,
  type ResolvedValue,
} from "./resolve";
import type { ReferenceInput } from "./generation/types";

export interface NodeRunnerContext {
  runId: string;
  userId: string | null;
  defaultFolderId: string | null;
}

export interface WorkflowNodeRow {
  id: string;
  type: string;
  dataJson: Record<string, unknown>;
}

export interface NodeExecutionResult {
  outputs: Record<string, ResolvedValue>;
  assetIds: string[];
  note?: string;
}

async function resolveAssetValue(assetId: string): Promise<ResolvedValue> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) throw new Error(`Asset not found: ${assetId}`);
  const url = await createDownloadUrl(asset.storageKey);
  return { kind: "asset", assetId: asset.id, url, mimeType: asset.mimeType ?? "application/octet-stream", assetType: asset.type };
}

async function generateOnce(
  modelId: string,
  prompt: string | undefined,
  references: ReferenceInput[] | undefined,
  settings: Record<string, unknown> | undefined,
  ctx: NodeRunnerContext,
): Promise<{ assetIds: string[] }> {
  const model = getModelById(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const adapter = getGenerationAdapter(modelId);
  const result = await adapter({
    modelId,
    prompt,
    references: references && references.length > 0 ? references : undefined,
    settings,
  });

  const perCallCost = estimateCost({
    modelId,
    count: 1,
    seconds: Number(settings?.durationSeconds ?? settings?.duration ?? 1),
    characters: prompt?.length ?? 0,
    settings,
  });
  const costPerOutput =
    perCallCost.verified && perCallCost.estimatedUsd !== null ? perCallCost.estimatedUsd / result.outputs.length : null;

  const assetIds: string[] = [];
  for (const output of result.outputs) {
    const ext = output.mimeType.split("/")[1]?.split(";")[0] ?? "bin";
    const key = buildAssetStorageKey("assets", `${modelId}-${randomUUID()}.${ext}`);
    await putObject(key, output.data, output.mimeType);

    const asset = await one(
      db
        .insert(assets)
        .values({
          type: output.type,
          mimeType: output.mimeType,
          title: prompt?.slice(0, 80) || model.label,
          folderId: ctx.defaultFolderId,
          storageKey: key,
          sourceKind: "workflow",
          sourceRunId: ctx.runId,
          metadataJson: { modelId, prompt: prompt ?? null, settings: settings ?? {}, costUsd: costPerOutput },
          createdBy: ctx.userId,
        })
        .returning(),
    );
    assetIds.push(asset.id);
  }

  return { assetIds };
}

/**
 * Generates `count` variants (bulk output count, folded into the generator
 * node itself rather than a separate Bulk Generator node type). One failed
 * variant doesn't abort the rest — matches AGENTS.md §10.4's per-item
 * status/retry-ability requirement.
 */
async function generateAndSaveAsset(
  modelId: string,
  prompt: string | undefined,
  references: ReferenceInput[] | undefined,
  settingsWithCount: Record<string, unknown> | undefined,
  ctx: NodeRunnerContext,
): Promise<{ assetIds: string[]; failures: string[] }> {
  const { count: rawCount, ...settings } = settingsWithCount ?? {};
  const count = Math.max(1, Math.min(50, Number(rawCount) || 1));

  const assetIds: string[] = [];
  const failures: string[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const result = await generateOnce(modelId, prompt, references, settings, ctx);
      assetIds.push(...result.assetIds);
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (assetIds.length === 0 && failures.length > 0) {
    throw new Error(failures[0]);
  }

  return { assetIds, failures };
}

function fillTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined ? "" : String(value);
  });
}

export async function executeNode(
  node: WorkflowNodeRow,
  inputs: Record<string, ResolvedValue | undefined>,
  ctx: NodeRunnerContext,
): Promise<NodeExecutionResult> {
  const data = node.dataJson ?? {};

  switch (node.type) {
    case "text_input": {
      return { outputs: { value: { kind: "text", value: (data.value as string) ?? "" } }, assetIds: [] };
    }

    case "asset_input": {
      const assetId = data.assetId as string | undefined;
      if (!assetId) throw new Error("Asset Input node has no asset selected");
      return { outputs: { value: await resolveAssetValue(assetId) }, assetIds: [] };
    }

    case "reference_input": {
      const referenceId = data.referenceId as string | undefined;
      if (!referenceId) throw new Error("Reference Input node has no reference selected");
      const [ref] = await db.select().from(references).where(eq(references.id, referenceId)).limit(1);
      if (!ref) throw new Error(`Reference not found: ${referenceId}`);
      let url: string | null = null;
      let mimeType: string | null = null;
      if (ref.assetId) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, ref.assetId)).limit(1);
        if (asset) {
          url = await createDownloadUrl(asset.storageKey);
          mimeType = asset.mimeType;
        }
      }
      return { outputs: { value: { kind: "reference", referenceId, url, mimeType } }, assetIds: [] };
    }

    case "character_input": {
      const characterId = data.characterId as string | undefined;
      if (!characterId) throw new Error("Character Input node has no character selected");
      const [char] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
      if (!char) throw new Error(`Character not found: ${characterId}`);
      let url: string | null = null;
      let mimeType: string | null = null;
      if (char.referenceAssetId) {
        const [asset] = await db.select().from(assets).where(eq(assets.id, char.referenceAssetId)).limit(1);
        if (asset) {
          url = await createDownloadUrl(asset.storageKey);
          mimeType = asset.mimeType;
        }
      }
      return { outputs: { value: { kind: "character", characterId, url, mimeType } }, assetIds: [] };
    }

    case "image_generator":
    case "audio_generator":
    case "video_generator": {
      const modelId = data.modelId as string | undefined;
      if (!modelId) throw new Error(`${node.type} has no model selected`);

      const contextText = resolvedValueToContextText(inputs.context);
      const basePrompt = resolvedValueToText(inputs.prompt) ?? (data.prompt as string | undefined) ?? "";
      const prompt = contextText ? `${contextText}\n\n---\n\n${basePrompt}` : basePrompt;
      const references = collectReferences(inputs);
      const outputPort = node.type === "image_generator" ? "image" : node.type === "audio_generator" ? "audio" : "video";

      const { assetIds, failures } = await generateAndSaveAsset(
        modelId,
        prompt,
        references,
        data.settings as Record<string, unknown> | undefined,
        ctx,
      );
      const outputValue = assetIds[0] ? await resolveAssetValue(assetIds[0]) : undefined;
      return {
        outputs: outputValue ? { [outputPort]: outputValue } : {},
        assetIds,
        note:
          assetIds.length > 1 || failures.length > 0
            ? `${assetIds.length} succeeded, ${failures.length} failed`
            : undefined,
      };
    }

    case "prompt_template": {
      const template = (data.template as string) ?? "";
      const inlineVars = (data.variables as Record<string, unknown>) ?? {};
      const inputVars = inputs.variables?.kind === "json" ? (inputs.variables.value as Record<string, unknown>) : {};
      return { outputs: { text: { kind: "text", value: fillTemplate(template, { ...inlineVars, ...inputVars }) } }, assetIds: [] };
    }

    case "prompt_combiner": {
      const separator = (data.separator as string) ?? " ";
      const a = resolvedValueToText(inputs.a) ?? "";
      const b = resolvedValueToText(inputs.b) ?? "";
      return { outputs: { text: { kind: "text", value: `${a}${separator}${b}` } }, assetIds: [] };
    }

    case "superos_context_search": {
      const query = resolvedValueToText(inputs.query) ?? (data.query as string) ?? "";
      if (!query) throw new Error("superOS Context Search has no query");
      const mode = (data.mode as "suggested" | "agentic" | "pinned") ?? "suggested";
      const topK = (data.topK as number) ?? 6;

      const results =
        mode === "agentic"
          ? await retrieveContextAgentic(query, topK)
          : mode === "pinned" && data.contextPackId
            ? await resolvePinnedContext(data.contextPackId as string, query, topK)
            : await retrieveContext(query, topK);

      return {
        outputs: {
          context: {
            kind: "context",
            chunks: results.map((r) => ({ sourceRef: r.sourceRef, sourceTitle: r.sourceTitle, content: r.content })),
          },
        },
        assetIds: [],
      };
    }

    case "context_pack": {
      const contextPackId = data.contextPackId as string | undefined;
      if (!contextPackId) throw new Error("Context Pack node has no pack selected");
      const pack = await getContextPack(contextPackId);
      if (!pack) throw new Error(`Context pack not found: ${contextPackId}`);
      const chunks = await getChunksForSourceRefs((pack.pinnedSourcesJson as string[]) ?? []);
      return {
        outputs: {
          context: { kind: "context", chunks: chunks.map((c) => ({ sourceRef: c.sourceRef, sourceTitle: c.sourceTitle, content: c.content })) },
        },
        assetIds: [],
      };
    }

    case "context_summarizer": {
      const text = resolvedValueToContextText(inputs.context);
      if (!text) throw new Error("Context Summarizer received no context to summarize");
      const summary = await geminiGenerateText(
        `Summarize the following superOS product/brand context into a short, dense brief usable as generation context. Keep concrete facts, drop filler:\n\n${text}`,
      );
      return { outputs: { context: { kind: "context", chunks: [{ sourceRef: "summarized", sourceTitle: "Summarized context", content: summary }] } }, assetIds: [] };
    }

    case "list_batch": {
      const items = inputs.items?.kind === "json" ? inputs.items.value : (data.items ?? []);
      return { outputs: { list: { kind: "json", value: items } }, assetIds: [] };
    }

    case "router": {
      const route = (data.route as string) === "b" ? "b" : "a";
      const value = inputs.input ?? { kind: "empty" as const };
      return { outputs: { [route]: value }, assetIds: [] };
    }

    case "save_to_asset_library": {
      const input = inputs.asset;
      if (!input || input.kind !== "asset") throw new Error("Save To Asset Library received no asset");
      const folderId = (data.folderId as string | undefined) ?? null;
      await db.update(assets).set({ folderId, updatedAt: new Date() }).where(eq(assets.id, input.assetId));
      return { outputs: {}, assetIds: [input.assetId] };
    }

    case "export_bundle": {
      const input = inputs.assets;
      const assetIds = input?.kind === "json" && Array.isArray(input.value) ? (input.value as string[]) : [];
      return {
        outputs: {},
        assetIds,
        note: "Export Bundle records a manifest only — zip packaging isn't wired up yet.",
      };
    }

    case "format_converter":
    case "frame_extractor":
    case "audio_extractor":
      throw new Error(
        `${node.type} requires a media-processing pipeline (ffmpeg) that isn't wired into this build yet.`,
      );

    case "sticky_note":
    case "comment":
      return { outputs: {}, assetIds: [] };

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}
