import type { DataType } from "./data-types";

/**
 * Node type catalogue for v1, grouped per AGENTS.md section 9.
 * `Script Builder` node types are intentionally not listed here.
 */
export const NODE_CATEGORIES = [
  "input",
  "generation",
  "transform",
  "context",
  "reference",
  "utility",
  "output",
  "note",
] as const;

export type NodeCategory = (typeof NODE_CATEGORIES)[number];

export const NODE_TYPES = [
  // input
  "text_input",
  "asset_input",
  "reference_input",
  "character_input",
  // generation
  "image_generator",
  "audio_generator",
  "video_generator",
  // transform
  "prompt_template",
  "prompt_combiner",
  "format_converter",
  "frame_extractor",
  "audio_extractor",
  // context
  "superos_context_search",
  "context_pack",
  "context_summarizer",
  // utility
  "list_batch",
  "router",
  // output
  "save_to_asset_library",
  "export_bundle",
  // canvas support
  "sticky_note",
  "comment",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_CATEGORY_BY_TYPE: Record<NodeType, NodeCategory> = {
  text_input: "input",
  asset_input: "input",
  reference_input: "input",
  character_input: "input",
  image_generator: "generation",
  audio_generator: "generation",
  video_generator: "generation",
  prompt_template: "transform",
  prompt_combiner: "transform",
  format_converter: "transform",
  frame_extractor: "transform",
  audio_extractor: "transform",
  superos_context_search: "context",
  context_pack: "context",
  context_summarizer: "context",
  list_batch: "utility",
  router: "utility",
  save_to_asset_library: "output",
  export_bundle: "output",
  sticky_note: "note",
  comment: "note",
};

export interface NodePortDefinition {
  id: string;
  label: string;
  dataType: DataType;
  required?: boolean;
  multiple?: boolean;
}

export interface NodeDefinition {
  type: NodeType;
  category: NodeCategory;
  label: string;
  description: string;
  inputs: NodePortDefinition[];
  outputs: NodePortDefinition[];
  /** Node stays meaningfully usable with zero incoming edges. */
  standaloneCapable: boolean;
}

/**
 * Concrete port contract for every node type in the v1 catalogue. This is
 * the single source of truth the canvas renderer, the edge-type validator,
 * and the workflow executor all read from — do not fork a second copy of
 * these port lists elsewhere.
 */
export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  text_input: {
    type: "text_input",
    category: "input",
    label: "Text Input",
    description: "A literal text value, editable inline.",
    inputs: [],
    outputs: [{ id: "value", label: "Text", dataType: "text" }],
    standaloneCapable: true,
  },
  asset_input: {
    type: "asset_input",
    category: "input",
    label: "Asset Input",
    description: "Pick an existing asset from the library.",
    inputs: [],
    outputs: [{ id: "value", label: "Asset", dataType: "any" }],
    standaloneCapable: true,
  },
  reference_input: {
    type: "reference_input",
    category: "input",
    label: "Reference Input",
    description: "Pick a saved Reference.",
    inputs: [],
    outputs: [{ id: "value", label: "Reference", dataType: "reference" }],
    standaloneCapable: true,
  },
  character_input: {
    type: "character_input",
    category: "input",
    label: "Character Input",
    description: "Pick a saved Character.",
    inputs: [],
    outputs: [{ id: "value", label: "Character", dataType: "character" }],
    standaloneCapable: true,
  },
  image_generator: {
    type: "image_generator",
    category: "generation",
    label: "Image Generator",
    description: "Generate one or more image variants with a registry model.",
    inputs: [
      { id: "prompt", label: "Prompt", dataType: "text" },
      { id: "reference", label: "Reference", dataType: "reference" },
      { id: "character", label: "Character", dataType: "character" },
      { id: "image", label: "Image", dataType: "image" },
      { id: "context", label: "Context", dataType: "context" },
    ],
    outputs: [{ id: "image", label: "Image", dataType: "image" }],
    standaloneCapable: true,
  },
  audio_generator: {
    type: "audio_generator",
    category: "generation",
    label: "Audio Generator",
    description: "Generate one or more audio variants with a registry model.",
    inputs: [
      { id: "prompt", label: "Prompt", dataType: "text" },
      { id: "reference", label: "Reference", dataType: "reference" },
    ],
    outputs: [{ id: "audio", label: "Audio", dataType: "audio" }],
    standaloneCapable: true,
  },
  video_generator: {
    type: "video_generator",
    category: "generation",
    label: "Video Generator",
    description: "Generate one or more video variants with a registry model.",
    inputs: [
      { id: "prompt", label: "Prompt", dataType: "text" },
      { id: "reference", label: "Reference", dataType: "reference" },
      { id: "character", label: "Character", dataType: "character" },
      { id: "image", label: "Image", dataType: "image" },
      { id: "video", label: "Video", dataType: "video" },
      { id: "audio", label: "Audio", dataType: "audio" },
      { id: "frames", label: "Frames", dataType: "frames" },
      { id: "context", label: "Context", dataType: "context" },
    ],
    outputs: [{ id: "video", label: "Video", dataType: "video" }],
    standaloneCapable: true,
  },
  prompt_template: {
    type: "prompt_template",
    category: "transform",
    label: "Prompt Template",
    description: "Fill a template string with variables.",
    inputs: [{ id: "variables", label: "Variables", dataType: "json" }],
    outputs: [{ id: "text", label: "Text", dataType: "text" }],
    standaloneCapable: true,
  },
  prompt_combiner: {
    type: "prompt_combiner",
    category: "transform",
    label: "Prompt Combiner",
    description: "Join two text values.",
    inputs: [
      { id: "a", label: "A", dataType: "text", required: true },
      { id: "b", label: "B", dataType: "text", required: true },
    ],
    outputs: [{ id: "text", label: "Text", dataType: "text" }],
    standaloneCapable: false,
  },
  format_converter: {
    type: "format_converter",
    category: "transform",
    label: "Format Converter",
    description: "Convert a value between compatible types.",
    inputs: [{ id: "input", label: "Input", dataType: "any", required: true }],
    outputs: [{ id: "output", label: "Output", dataType: "any" }],
    standaloneCapable: false,
  },
  frame_extractor: {
    type: "frame_extractor",
    category: "transform",
    label: "Frame Extractor",
    description: "Pull still frames out of a video.",
    inputs: [{ id: "video", label: "Video", dataType: "video", required: true }],
    outputs: [{ id: "frames", label: "Frames", dataType: "frames" }],
    standaloneCapable: false,
  },
  audio_extractor: {
    type: "audio_extractor",
    category: "transform",
    label: "Audio Extractor",
    description: "Pull the audio track out of a video.",
    inputs: [{ id: "video", label: "Video", dataType: "video", required: true }],
    outputs: [{ id: "audio", label: "Audio", dataType: "audio" }],
    standaloneCapable: false,
  },
  superos_context_search: {
    type: "superos_context_search",
    category: "context",
    label: "superOS Context Search",
    description: "Semantic search over the superOS knowledge base.",
    inputs: [{ id: "query", label: "Query", dataType: "text" }],
    outputs: [{ id: "context", label: "Context", dataType: "context" }],
    standaloneCapable: true,
  },
  context_pack: {
    type: "context_pack",
    category: "context",
    label: "Context Pack",
    description: "A pinned, curated set of context sources.",
    inputs: [],
    outputs: [{ id: "context", label: "Context", dataType: "context" }],
    standaloneCapable: true,
  },
  context_summarizer: {
    type: "context_summarizer",
    category: "context",
    label: "Context Summarizer",
    description: "Condense retrieved context down for a run.",
    inputs: [{ id: "context", label: "Context", dataType: "context", required: true }],
    outputs: [{ id: "context", label: "Context", dataType: "context" }],
    standaloneCapable: false,
  },
  list_batch: {
    type: "list_batch",
    category: "utility",
    label: "List / Batch",
    description: "A literal list of items for bulk operations.",
    inputs: [{ id: "items", label: "Items", dataType: "json" }],
    outputs: [{ id: "list", label: "List", dataType: "json" }],
    standaloneCapable: true,
  },
  router: {
    type: "router",
    category: "utility",
    label: "Router",
    description: "Route a value to one of several branches.",
    inputs: [{ id: "input", label: "Input", dataType: "any", required: true }],
    outputs: [
      { id: "a", label: "A", dataType: "any" },
      { id: "b", label: "B", dataType: "any" },
    ],
    standaloneCapable: false,
  },
  save_to_asset_library: {
    type: "save_to_asset_library",
    category: "output",
    label: "Save To Asset Library",
    description: "File an upstream asset into a specific folder.",
    inputs: [{ id: "asset", label: "Asset", dataType: "any", required: true }],
    outputs: [],
    standaloneCapable: false,
  },
  export_bundle: {
    type: "export_bundle",
    category: "output",
    label: "Export Bundle",
    description: "Collect multiple assets into one exportable set.",
    inputs: [{ id: "assets", label: "Assets", dataType: "any", multiple: true, required: true }],
    outputs: [],
    standaloneCapable: false,
  },
  sticky_note: {
    type: "sticky_note",
    category: "note",
    label: "Sticky Note",
    description: "Freeform note on the canvas.",
    inputs: [],
    outputs: [],
    standaloneCapable: true,
  },
  comment: {
    type: "comment",
    category: "note",
    label: "Comment",
    description: "Freeform comment on the canvas.",
    inputs: [],
    outputs: [],
    standaloneCapable: true,
  },
};
