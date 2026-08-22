import { getModelById, type ModelDefinition } from "./models";

export interface CostEstimateInput {
  modelId: string;
  /** Number of outputs requested (variant count / batch count). */
  count?: number;
  /** Seconds of output, for per-second priced models (video/audio). */
  seconds?: number;
  /** Character count of the prompt/script, for per-character priced models. */
  characters?: number;
  /** Current settings values — consulted against the model's `pricing.perOption` tier, if any. */
  settings?: Record<string, unknown>;
}

export interface CostEstimate {
  model: ModelDefinition;
  count: number;
  /** Null when the model's pricing is not yet verified. */
  estimatedUsd: number | null;
  verified: boolean;
}

/**
 * Shared pricing service used by both Playground and Workflow so estimates
 * never diverge between the two surfaces (AGENTS.md hard rule 7 / 10.2).
 */
export function estimateCost(input: CostEstimateInput): CostEstimate {
  const model = getModelById(input.modelId);
  if (!model) {
    throw new Error(`Unknown model id: ${input.modelId}`);
  }

  const count = input.count ?? 1;

  if (model.pricing.computeUsd) {
    const perUnit = model.pricing.computeUsd(input);
    if (perUnit === null) return { model, count, estimatedUsd: null, verified: false };
    return { model, count, estimatedUsd: perUnit * count, verified: true };
  }

  if (!model.pricing.verified || model.pricing.estimatedUsd === null) {
    return { model, count, estimatedUsd: null, verified: false };
  }

  let perUnit = model.pricing.estimatedUsd;
  const perOption = model.pricing.perOption;
  if (perOption) {
    const selected = input.settings?.[perOption.settingKey];
    if (typeof selected === "string" && selected in perOption.values) {
      perUnit = perOption.values[selected]!;
    }
  }
  if (model.pricing.unit === "per_second") {
    perUnit *= input.seconds ?? 1;
  } else if (model.pricing.unit === "per_1k_characters") {
    perUnit *= (input.characters ?? 0) / 1000;
  } else if (model.pricing.unit === "per_character") {
    perUnit *= input.characters ?? 0;
  }

  return { model, count, estimatedUsd: perUnit * count, verified: true };
}

export function exceedsThreshold(estimate: CostEstimate, thresholdUsd: number): boolean {
  return estimate.estimatedUsd !== null && estimate.estimatedUsd > thresholdUsd;
}
