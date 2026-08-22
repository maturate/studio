# AGENTS.md — superOS Workflow Studio

> Source of truth for planning and building the `superOS` internal webapp for AI-assisted content generation workflows.
> Read this file before designing, scaffolding, or implementing anything in this project.

---

## 1. Product identity

- **Working name:** `superOS Workflow Studio`
- **What it is:** an internal webapp for building, testing, and running repeatable AI content workflows for `superOS`
- **Who it is for:** the `superOS` team only
- **Access model:** Google OAuth sign-in, then hard allowlist by authorized email
- **Primary outcome:** generate consistent `superOS` assets and content through reusable workflows instead of one-off prompting

This product is not the `superOS` end-user assistant surface. It is an internal production tool used to create outputs for `superOS` marketing, brand, story, design, media, and future agent/tool workflows.

The closest product reference is the `Spaces` surface in Magnific: an infinite-canvas workflow editor where nodes are useful on their own, but become more powerful when connected into a graph.

---

## 2. What this plan covers

This file plans the webapp features that are in scope now:

1. `Asset Library`
2. `Playground` for image, audio, and video generation
3. `Workflow` canvas with multi-step AI pipelines
4. `superOS` context retrieval inside workflows
5. Auth and internal access control
6. Shared model settings, presets, cost/budget estimation, and output management

### Explicitly out of scope for now

- `Script Builder`

Do not plan or implement `Script Builder` in this first pass except where the workflow architecture needs a reserved integration point for it later.

---

## 3. Product goals

The app should make it easy for the team to:

1. generate assets in a fast single-step playground
2. organize all generated outputs in a foldered asset library
3. build reusable node-based workflows for more complex content generation
4. inject trusted `superOS` product and brand context into generation runs
5. batch and scale repeatable content jobs without losing consistency
6. estimate cost before running expensive media generations
7. reuse references, characters, prompts, presets, and outputs across the product

### Non-goals

- consumer-facing collaboration features
- public sharing or marketplace features
- open sign-up
- broad multi-tenant SaaS behavior
- planning around general-purpose team chat, docs, or PM workflows outside content production

---

## 4. Product principles

1. **Useful without graph complexity.** A single generator should be usable from the `Playground` or as a standalone node without wiring a full graph.
2. **Progressive disclosure.** Beginner usage should feel simple; advanced graph behavior should unlock naturally.
3. **Everything becomes an asset.** Uploads, generations, references, characters, and workflow outputs should land in one shared asset system.
4. **`superOS` context is first-class.** Context retrieval is not an afterthought; it is part of the product's value.
5. **Cost visibility before execution.** Show estimates early in both `Playground` and `Workflow`.
6. **Internal-only security.** Auth is strict; only authorized team emails can enter.
7. **Composability over one-off screens.** Shared primitives should power playgrounds, workflows, presets, assets, and later `Script Builder`.
8. **Versionable workflows.** Workflows should be durable, editable, clonable, and safe to evolve.
9. **Narrow model catalog first.** Do not expose a giant model marketplace; only ship the production-approved models/tooling already named in the `superOS` knowledge base until the owner expands the list.

---

## 5. Core product surfaces

### 5.1 App shell

The app shell should include:

- top nav for `Playground`, `Workflow`, `Asset Library`, `References`, `Characters`, and `Settings`
- workspace/project switcher if needed later, but start with a single internal workspace
- global model/provider settings access
- global credit/budget view
- recent runs / notifications entry

### 5.2 Asset Library

The `Asset Library` is the shared storage and retrieval layer for everything produced by the system.

Must support:

- folders and nested organization
- file uploads
- generated outputs from `Playground` and `Workflow`
- metadata tags
- search and filters
- asset previews
- selection as workflow inputs
- output-folder targeting for runs
- asset provenance: where it came from, which workflow/node produced it, and with which settings

Asset categories should at least support:

- images
- audio
- video
- prompts / text artifacts
- references
- character assets
- workflow outputs

### 5.3 Playground

The `Playground` is the fast execution surface for one-off generation and iteration.

Initial modes:

- image
- audio
- video

Each mode should support:

- prompt input
- upload/reference inputs when relevant
- model selection
- model-specific settings
- budget or cost estimation
- generation count / variant count where relevant
- output preview
- save to asset library
- reuse output as workflow input later

The `Playground` should share the same underlying model registry and execution engine used by `Workflow`.

### 5.3A Initial model and tooling scope

Do **not** copy Magnific's broad model-catalog approach for v1.

The initial registry should be constrained to the production-approved tools and model families already named in `superOS/Docs/marketing/production.md`, using these normalized names:

- `Gemini 3.1 Flash TTS Preview` (`gemini-3.1-flash-tts-preview`)
- `ElevenLabs Multilingual v2` (`eleven_multilingual_v2`)
- `ElevenLabs v3` (`eleven_v3`)
- `Veo 3.1` (`veo-3.1-generate-preview`)
- `Gemini Omni Flash Preview` (`gemini-omni-flash-preview`)
- `Gemini 3.1 Flash Image` (`gemini-3.1-flash-image`)
- `Seedance 2.5`
- `Kling Video 3.0 Omni` (`kuaishou/kling-video-3.0-omni`)
- `Seedream 5.0 Pro`

If the marketing production file changes later, update this list in the same piece of work that expands the registry.

### 5.4 Workflow

The `Workflow` surface is the main differentiator.

It should support:

- infinite canvas
- multiple canvases/pages per workflow
- nodes and edges
- typed inputs and outputs for text, image, audio, video, frames, and generic objects
- cursor/select tool
- hand/pan tool
- add-node tool
- edge cutting tool
- notes/comments tool
- undo / redo
- run single node
- run from node
- run whole connected workflow
- output-folder selection in the asset library

The workflow canvas should feel close to Magnific `Spaces`, but adapted for internal `superOS` production needs.

### 5.5 References and Characters

`References` and `Characters` should be first-class reusable objects, not loose files.

They should support:

- metadata and tagging
- image/file attachments
- notes / description
- use as typed node inputs
- search in palette or selectors
- linkage to outputs and workflows

### 5.6 `superOS` context system

The workflow system should be able to fetch and package trusted `superOS` context from the knowledge base when needed.

This should behave more like a context service / agent than a dumb file picker.

Capabilities should include:

- sync or ingest docs from the `superOS` knowledge base
- retrieve context by topic, tag, or intent
- pin context packs to a workflow
- attach context to a specific node run
- preserve consistency across multi-step generations
- show what source context was used for a given output

This is central to the product, because the goal is not merely "generate media"; it is "generate media consistent with `superOS`."

---

## 6. Recommended architecture

Unless the owner explicitly changes direction, these are the locked stack decisions for this repo:

- **App framework:** `Next.js` App Router
- **Language:** `TypeScript`
- **Package manager:** `npm` workspaces for this repo
- **UI:** `Tailwind CSS` first, `shadcn/ui`-style component layer when needed
- **Canvas:** `React Flow`
- **Auth:** `Auth.js` with Google provider + server-side authorized-email allowlist
- **ORM / schema:** `Drizzle ORM`
- **Database:** `Postgres`
- **Vector search:** `pgvector` in the same Postgres cluster
- **Queue / background jobs:** `Redis` + `BullMQ`
- **Object storage:** `Cloudflare R2` in hosted environments, `S3`-compatible fallback accepted
- **Execution shape:** Next.js app for UI/API plus separate Node/TypeScript workers for media and workflow jobs

### Why this architecture

- `React Flow` is the right starting point for a Magnific-style node editor
- `Next.js` keeps product development fast for an internal tool with a strong UI surface
- `Auth.js` is the most direct fit for Google OAuth plus access gating
- `Drizzle + Postgres + pgvector` keeps relational data and semantic retrieval in one place
- `Redis + BullMQ` preserves the familiar queue posture from the earlier backend shape while fitting the web stack better than an ad hoc in-request executor
- shared object storage is required for the asset library and generated outputs

### Local development defaults

Use these defaults unless the owner asks otherwise:

- local app: `Next.js` dev server
- local database: Dockerized `Postgres`
- local queue/cache: Dockerized `Redis`
- local object storage: `MinIO` or another `S3`-compatible local bucket only if storage work is being built right now
- local auth: real Google OAuth app with localhost callback
- local package manager: `npm`

### Hard architectural rules

1. Keep a single canonical `model registry` abstraction. Do not hardcode per-screen model options.
2. Keep a single canonical `asset` abstraction. Do not create separate disconnected storage concepts per feature.
3. Workflow execution must run through a queue/worker layer, not directly in the request thread.
4. Node input/output types must be explicit and machine-readable.
5. Every run should record settings, estimated cost, actual cost if available, status, timestamps, and outputs.
6. `superOS` context must be versioned or source-attributed so outputs remain explainable.
7. `Playground` and `Workflow` must share providers, presets, and pricing logic.
8. Keep `Auth`, `DB`, `queue`, and `storage` swappable at the adapter layer, but do not build multiple providers before the first working path exists.
9. The model registry must stay limited to the tools/model families named in `superOS/Docs/marketing/production.md` until the owner explicitly expands scope.

---

## 7. Information architecture

Recommended top-level navigation:

1. `Playground`
2. `Workflows`
3. `Asset Library`
4. `References`
5. `Characters`
6. `Settings`

Optional later:

- `Runs`
- `Templates`
- `Script Builder`

---

## 8. Data model overview

Use a relational core with clear IDs and metadata. The exact schema can evolve, but these entities should exist early.

### 8.1 Auth and access

- `users`
  - id
  - email
  - name
  - avatar_url
  - google_subject_id
  - role
  - is_authorized
  - created_at
  - updated_at

- `allowed_emails`
  - id
  - email
  - notes
  - active
  - created_at

### 8.2 Assets

- `assets`
  - id
  - type
  - mime_type
  - title
  - description
  - folder_id
  - storage_key
  - preview_key
  - source_kind (`upload`, `playground`, `workflow`, `reference`, `character`)
  - source_run_id
  - metadata_json
  - created_by
  - created_at
  - updated_at

- `asset_folders`
  - id
  - parent_id
  - name
  - path_cache
  - created_at
  - updated_at

- `asset_tags`
- `asset_tag_links`

### 8.3 References and characters

- `references`
  - id
  - type
  - title
  - description
  - asset_id
  - metadata_json

- `characters`
  - id
  - name
  - description
  - reference_asset_id
  - metadata_json

### 8.4 Workflows

- `workflows`
  - id
  - name
  - description
  - status
  - latest_version_id
  - created_by
  - created_at
  - updated_at

- `workflow_versions`
  - id
  - workflow_id
  - version_number
  - canvas_state_json
  - notes
  - created_by
  - created_at

- `workflow_pages`
  - id
  - workflow_version_id
  - name
  - order_index

- `workflow_nodes`
  - id
  - workflow_version_id
  - page_id
  - type
  - title
  - position_x
  - position_y
  - width
  - height
  - data_json
  - created_at
  - updated_at

- `workflow_edges`
  - id
  - workflow_version_id
  - source_node_id
  - source_port
  - target_node_id
  - target_port
  - data_type
  - page_id

### 8.5 Runs

- `runs`
  - id
  - run_scope (`playground`, `workflow_node`, `workflow_branch`, `workflow_full`, `bulk`)
  - status
  - initiated_by
  - estimated_cost
  - actual_cost
  - output_folder_id
  - started_at
  - completed_at
  - failed_at

- `run_steps`
  - id
  - run_id
  - node_id
  - status
  - input_snapshot_json
  - settings_snapshot_json
  - output_snapshot_json
  - logs_json
  - started_at
  - completed_at

### 8.6 `superOS` context

- `knowledge_sources`
  - id
  - source_type (`repo`, `file`, `manual_note`)
  - source_ref
  - source_hash
  - title
  - active
  - synced_at

- `knowledge_chunks`
  - id
  - knowledge_source_id
  - content
  - embedding
  - metadata_json

- `context_packs`
  - id
  - name
  - description
  - selection_rules_json
  - pinned_sources_json

- `run_context_links`
  - id
  - run_id
  - node_id
  - context_pack_id
  - resolved_sources_json

---

## 9. Node system

The canvas should use one renderer pattern with a discriminated `node type` data object underneath, not a separate canvas implementation per node family.

### 9.1 Node categories for v1

Start with these node groups:

1. `Input nodes`
2. `Generation nodes`
3. `Transform nodes`
4. `Context nodes`
5. `Reference nodes`
6. `Utility nodes`
7. `Output nodes`
8. `Comment/note nodes`

### 9.2 Initial node catalogue

#### Input nodes

- `Text Input`
- `Asset Input`
- `Reference Input`
- `Character Input`

#### Generation nodes

- `Image Generator`
- `Audio Generator`
- `Video Generator`

Each generator node carries a bulk output count as part of its own settings (not a separate node type) — set it above 1 to generate N variants from the same node in one run.

#### Transform nodes

- `Prompt Template`
- `Prompt Combiner`
- `Format Converter`
- `Frame Extractor`
- `Audio Extractor`

#### Context nodes

- `superOS Context Search`
- `Context Pack`
- `Context Summarizer`

#### Utility nodes

- `List / Batch`
- `Router`
- `Condition` later if needed, but do not start with branching complexity unless execution requires it

#### Output nodes

- `Save To Asset Library`
- `Export Bundle`

#### Canvas support nodes

- `Sticky Note`
- `Comment`

### 9.3 Node rules

1. Each node must define typed input ports and output ports.
2. Each node must store its config separately from run state.
3. Each node should support local preview where practical.
4. Cost estimation must update when settings change.
5. Nodes should stay useful even with zero connections when possible.

### 9.4 Data types

At minimum support:

- `text`
- `image`
- `images`
- `audio`
- `video`
- `frames`
- `reference`
- `character`
- `context`
- `json`
- `any`

---

## 10. Execution model

### 10.1 Run scopes

The workflow system should support:

1. `This node only`
2. `Run from here`
3. `Run connected workflow`

Only show run scopes that are valid for the selected node.

### 10.2 Cost model

Every runnable surface should show:

- estimated cost before run
- provider/model assumptions
- likely output count
- warning when cost exceeds a user-defined threshold

`Playground` and `Workflow` should both rely on the same pricing service.

### 10.3 Execution records

Each run should persist:

- selected model and settings
- resolved inputs
- resolved `superOS` context
- estimates
- actual outputs
- status and errors
- output asset links

### 10.4 Bulk generation

Bulk generation should not be a hacked loop outside the workflow system.

Implemented as a first-class part of every generator node's own settings — a
bulk output count, not a separate node type. Set it above 1 and the node
generates N variants of the same resolved prompt/inputs in one run. It:

- saves every output to the same output folder
- records per-variant success/failure inside the run step (one failure
  doesn't abort the rest)
- is retried by re-running the node, not per-item yet

---

## 11. `superOS` context architecture

This app must understand that `superOS` is a product with its own brand, world, rollout truth, and design language. Outputs should stay aligned with that.

### 11.1 Context sources

Use the `superOS` knowledge base as the main source of truth for:

- product positioning
- brand and writing rules
- rollout and capability truth
- design system and world
- asset-generation guidance

At planning time, local docs already show that `superOS` is:

- WhatsApp-first
- India-first in current rollout shape
- an assistant for getting everyday tasks done through one conversation
- strict about honest capability messaging

The context system should preserve this truth during content generation.

### 11.2 Required capabilities

The context layer should support:

1. repository ingestion and re-sync
2. chunking and embedding
3. semantic retrieval
4. pinned context packs per workflow
5. contextual citation or source display for operators
6. run-time context snapshots for reproducibility

### 11.3 Product requirement

If a workflow is creating something for `superOS`, the operator should be able to choose one of these modes:

- `No context`
- `Suggested context`
- `Pinned context pack`
- `Agentic context retrieval`

### 11.4 Guardrail

Do not let the context system silently pull arbitrary unrelated repo text into every run. Context must be:

- visible
- inspectable
- overrideable
- attributable

---

## 12. Auth and security

This app is internal and must be locked down.

### 12.1 Authentication

- Google OAuth only for v1
- no username/password auth
- authenticated session required for all app routes except sign-in

### 12.2 Authorization

Only allow access when the signed-in email exists in `allowed_emails` and is active.

If an email is valid with Google but not on the allowlist:

- deny access
- show a simple unauthorized screen
- do not create a usable session into the app shell

### 12.3 Minimum security requirements

- server-side session validation
- CSRF-safe auth flow
- signed upload URLs for storage
- audit logging for deletes and important workflow changes
- no public asset buckets by default

---

## 13. UX notes copied from the right reference ideas

The Magnific `Spaces` teardown suggests several decisions worth copying.

### Keep these

1. Nodes should feel like mini-app cards, not empty boxes with sockets.
2. Ports should be discoverable but not dominate the UI.
3. A unified asset identity is the right design for uploads plus generated outputs.
4. Multiple canvases/pages per workflow are worth supporting early.
5. Cost estimation before execution is a trust feature, not polish.
6. Search should cover node types, models, references, and templates.

### Do not over-copy

1. Do not ship a huge node catalog too early.
2. Do not hide basic controls behind overly clever UI.
3. Do not let new nodes insert off-screen or stack invisibly.
4. Do not assume public/community sharing is needed in v1.

---

## 14. Product roadmap

Build this in phases. Do not start with the full node universe.

### Phase 0 — Foundation and planning

Deliverables:

- `AGENTS.md`
- `CLAUDE.md`
- initial app architecture decision
- rough schema and route map

### Phase 1 — Auth and shell

Build:

- Next.js shell
- Google OAuth
- authorized email allowlist
- top-level navigation
- empty states for main surfaces

Acceptance:

- unauthorized emails cannot enter
- authorized users can sign in and reach the app shell

### Phase 2 — Asset Library

Build:

- folder structure
- uploads
- search/filter basics
- asset cards and previews
- save outputs into folders

Acceptance:

- uploaded assets are searchable and retrievable
- generated assets can later land in chosen folders

### Phase 3 — Playground

Build:

- image playground
- audio playground
- video playground
- model registry
- settings and cost estimator
- save to asset library

Acceptance:

- one-off generation works without touching workflows
- operators can compare models/settings and store outputs

### Phase 4 — Workflow canvas core

Build:

- React Flow canvas
- multiple pages/canvases
- add/select/pan/cut/comment tools
- undo/redo
- node/edge persistence
- typed ports

Acceptance:

- operators can create, save, reopen, and edit workflows
- multi-page workflows persist correctly

### Phase 5 — Workflow execution

Build:

- run scopes
- node execution engine
- background jobs
- run history
- output folder selection

Acceptance:

- single node, downstream, and full-workflow runs all work
- outputs are saved and traceable

### Phase 6 — `superOS` context system

Build:

- repo/doc ingestion
- embeddings and retrieval
- context packs
- context nodes
- run-time context attribution

Acceptance:

- operators can inject or pin `superOS` context into runs
- outputs show which context sources were used

### Phase 7 — References, characters, and bulk generation

Build:

- references CRUD
- characters CRUD
- typed use in playground/workflows
- bulk generator support
- batch result management

Acceptance:

- operators can run consistent multi-output jobs using references/characters

### Phase 8 — Templates, polish, and production readiness

Build:

- workflow cloning/versioning
- keyboard shortcuts
- performance work
- error states and retry UX
- audit logs
- usage monitoring

Acceptance:

- team can use the app reliably for real `superOS` production work

---

## 15. Suggested folder structure

Use a monorepo-friendly structure even if the first implementation stays in one app.

```text
.
├── AGENTS.md
├── CLAUDE.md
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── lib/
│       └── styles/
├── packages/
│   ├── db/
│   ├── model-registry/
│   ├── workflow-engine/
│   ├── context-engine/
│   ├── ui/
│   └── shared/
├── workers/
│   ├── media/
│   └── workflow/
├── docs/
│   ├── product/
│   ├── ux/
│   └── technical/
└── scripts/
```

The important idea is separation of:

- app shell and UI
- shared schema/business logic
- workflow execution
- `superOS` context ingestion and retrieval

---

## 16. Implementation guidance for future coding agents

When asked to build this app:

1. read `AGENTS.md` first
2. stay within the requested phase or scope
3. prefer shared primitives over isolated feature code
4. do not implement `Script Builder` unless explicitly requested later
5. keep `Playground`, `Workflow`, and `Asset Library` connected through shared abstractions
6. treat `superOS` context as a product requirement, not a future enhancement
7. preserve the internal-only auth model

### If implementation details are still missing

Use these defaults:

- `Next.js` App Router
- `TypeScript`
- `Tailwind CSS`
- `React Flow`
- `Auth.js` + Google OAuth + email allowlist
- `Drizzle ORM`
- `Postgres` + `pgvector`
- `Redis` + `BullMQ`
- `Cloudflare R2`

Only deviate if the user explicitly requests a different stack.

---

## 17. Immediate next build order

If starting implementation from scratch, do the work in this order:

1. scaffold app shell and auth
2. set up database and storage
3. build asset library primitives
4. build model registry and playground
5. build workflow canvas persistence
6. build workflow execution runtime
7. build `superOS` context ingestion and retrieval
8. build references/characters/bulk generation
9. polish operator UX and production safeguards

---

## 18. Compact mental model

Think of the app as five systems sharing one spine:

1. `Auth` controls who may enter
2. `Assets` store all usable inputs and outputs
3. `Playground` enables fast one-off generation
4. `Workflow` enables reusable multi-step generation
5. `Context` keeps everything aligned with `superOS`

If a future implementation makes these systems diverge too much, it is likely going in the wrong direction.
