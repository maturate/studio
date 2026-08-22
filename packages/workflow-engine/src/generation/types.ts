export interface ReferenceInput {
  /** Signed, fetchable URL for an image/audio reference asset. */
  url: string;
  mimeType: string;
}

export interface GenerationInput {
  modelId: string;
  prompt?: string;
  references?: ReferenceInput[];
  /** Model-specific knobs (aspect ratio, duration, voice id, etc). */
  settings?: Record<string, unknown>;
}

export interface GeneratedOutput {
  type: "image" | "audio" | "video";
  mimeType: string;
  data: Buffer;
}

export interface GenerationResult {
  outputs: GeneratedOutput[];
  providerMetadata?: Record<string, unknown>;
}

export type GenerationAdapter = (input: GenerationInput) => Promise<GenerationResult>;

export class ProviderNotConfiguredError extends Error {
  constructor(envVar: string) {
    super(`Missing required environment variable: ${envVar}`);
    this.name = "ProviderNotConfiguredError";
  }
}
