# Technical Docs

## Status

All phases through Phase 8 are implemented (Script Builder excluded, per
scope). Build/lint/typecheck are clean across every package, and the core
execution paths (asset upload round-trip, workflow graph execution, canvas
save upsert/delete-scoping, audit log, runs join) are verified against real
local Postgres + MinIO — see the smoke-test notes below. What's *not*
verified is anything requiring real provider credentials (Google/ElevenLabs
API calls, Google OAuth sign-in) — those need real secrets, added below.

### Packages

- `packages/db` — full Drizzle schema for AGENTS.md §8 plus two additions:
  `runs.target_node_id` (needed for `workflow_node`/`workflow_branch` run
  scopes to know which node was clicked) and `audit_logs` (AGENTS.md §12.3).
  `knowledge_chunks.embedding` is `vector(768)` with an HNSW cosine index,
  matching Gemini's `gemini-embedding-001`. Migrations in
  `packages/db/migrations`, seed script for `allowed_emails`. A `one()`
  helper wraps the common "insert `.returning()`, expect exactly one row"
  pattern used everywhere.
- `packages/shared` — canonical `DataType`/`NodeType` unions, plus
  `NODE_DEFINITIONS`: the concrete typed-port catalogue for all 21 v1 node
  types, read by the canvas renderer, the connection-type validator, and the
  workflow executor alike.
- `packages/model-registry` — the narrow model list from AGENTS.md §5.3A,
  plus a shared `estimateCost()` pricing service. Real per-model pricing is
  not yet verified — `estimatedUsd` stays `null` until confirmed, rather than
  guessing.
- `packages/storage` — S3-compatible adapter (`@aws-sdk/client-s3`) over
  presigned URLs (client uploads) and direct server-side `putObject` (used by
  the generation engine, which already holds output bytes in-process). Same
  client works against local MinIO or real Cloudflare R2 — only env vars
  change. No public bucket: all reads go through time-limited signed URLs.
- `packages/queue` — BullMQ queue definitions: `workflow-runs` (graph
  orchestration) and `media-runs` (standalone generation, including
  Playground). Two separate queues/workers so a slow Veo poll never blocks
  workflow orchestration and vice versa.
- `packages/context-engine` — real ingestion (paragraph-aware chunker,
  Gemini embeddings, content-hash dedup so re-syncing an unchanged file is a
  no-op) and retrieval (pgvector cosine search) over the superOS docs
  knowledge base. Three retrieval modes: `suggested` (top-K semantic),
  `pinned` (fixed source refs via a Context Pack), `agentic` (Gemini expands
  the query into a few sub-queries, results are merged/deduped by highest
  similarity — a real but deliberately modest agentic step, not a full agent
  loop).
- `packages/workflow-engine` — the shared execution layer:
  - `generation/providers/` — real adapters for Gemini image, Gemini TTS,
    Gemini Omni Flash, Veo (long-running-operation polling), ElevenLabs
    (**live-tested, works**), and Seedance/Seedream/Kling via the AnyFast
    aggregator (**Seedream live-tested, works**; Seedance/Kling built against
    AnyFast's documented contract but not yet live-tested — video generation
    costs more/takes longer, held off spending credits without asking).
    Google's adapters go through **Vertex AI** (`vertex-auth.ts`, OAuth2
    service account via `google-auth-library`'s `GoogleAuth` — auto-discovers
    `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default
    login`), not the plain Gemini Developer API key. Auth itself is
    confirmed working (reaches Vertex, gets a structured response) but the
    configured GCP identity currently lacks the `aiplatform.endpoints.predict`
    permission on `project-0fa7d958-2ae7-4c8d-996` — needs the `Vertex AI
    User` role (or equivalent) granted, and confirmation the Vertex AI API
    is enabled on that project.
  - `graph.ts` — topological sort + downstream-subgraph resolution for the
    three run scopes (`workflow_node`, `workflow_branch`, `workflow_full`).
  - `node-runner.ts` — dispatches every node type. Generation nodes call the
    provider adapters and persist assets; context nodes call
    `context-engine`; `format_converter`/`frame_extractor`/`audio_extractor`
    throw a clear "needs ffmpeg, not wired up" error rather than faking media
    processing that isn't there.
  - `run-workflow.ts` — the orchestrator called by `workers/workflow`. Halts
    the run on first node failure rather than executing downstream nodes on
    missing input.
  - `execute-playground-run.ts` — Playground now queues instead of running
    synchronously in the request thread: `createQueuedPlaygroundRun` creates
    the `runs`/`run_steps` rows and returns immediately;
    `executeQueuedPlaygroundRun` (called by `workers/media`) does the actual
    generation call. This isn't strictly required by AGENTS.md hard rule 3
    (that rule targets Workflow specifically), but a Veo call can poll for
    minutes and blocking an HTTP request that long is a real problem, so
    Playground gets the same queue treatment.
- `workers/workflow`, `workers/media` — thin BullMQ `Worker` processes; all
  the actual logic lives in `workflow-engine` so it's identically testable
  in-process (see smoke tests) or via the real queue.

### App (`apps/web`)

- Auth/shell from Phase 1, Asset Library from Phase 2 (see prior notes below
  if useful, condensed here since everything is now built).
- **Playground** (`/playground`) — mode tabs (image/audio/video), model
  select filtered from the registry, prompt, ElevenLabs voice id field when
  that model's selected, advanced-settings JSON escape hatch, folder
  picker, cost estimate display, enqueue + poll run status, output links
  into the Asset Library.
- **Workflow** (`/workflows`, `/workflows/[id]`) — `@xyflow/react` canvas.
  One generic node component driven by `NODE_DEFINITIONS` (not 21 bespoke
  components) with per-type inline config for the fields that matter most.
  Select/pan/cut-edge tools, add-node palette grouped by category,
  sticky-note/comment nodes, undo/redo (client-side history stack,
  Cmd+Z/Cmd+Shift+Z), multi-page tabs, save (upserts nodes by stable id so
  run history stays linked across edits; edges are fully replaced per page
  since nothing else references their identity), and all three run scopes
  wired to real execution with a polling run panel. Workflow list page
  supports duplicate (full clone: new workflow + version + all
  pages/nodes/edges with remapped ids) and delete.
- **Settings → superOS context** (`/settings/context`) — sync button
  (ingests `superOS/Docs`), source list with chunk counts, context pack
  creation (checkbox-select pinned sources) and deletion.
- **References** (`/references`) / **Characters** (`/characters`) — upload +
  create, grid view, delete. Each card shows its id for pasting into a
  Reference Input / Character Input node — there's no in-canvas asset picker
  modal yet, so this is the v1 bridge between the library and the canvas.
- **Runs** (`/runs`) — recent run history across scopes, joined to workflow
  name where applicable, status/cost/timestamps.
- Bulk generation is a `count` setting on every generator node/Playground
  mode (not a separate node type) — set above 1 to generate N variants of
  the same prompt in one run, sequentially, with one failure not aborting
  the rest. Matches AGENTS.md §10.4 structurally (retry-by-rerunning, not
  yet a per-variant retry button).
- Every generator model (Playground and the canvas node editor) exposes its
  real settings as typed controls — selects/sliders/checkboxes driven by
  `packages/model-registry/src/settings-schema.ts` — never a JSON textarea.
  Field names match exactly what each provider adapter reads, sourced from
  each provider's real API docs (Gemini image/TTS/Veo config fields,
  ElevenLabs voice_settings, AnyFast's per-model params).
- Audit log (`audit_logs` table) is written on every delete: asset, asset
  folder, workflow, reference, character, context pack.

### Deliberately not built

- Seedance/Kling live-testing (built and typechecked, not run against real credits — see above).
- ffmpeg-backed nodes (`format_converter`, `frame_extractor`,
  `audio_extractor`) — these throw a clear error instead of silently no-op'ing.
- An in-canvas asset/reference/character picker modal (currently: paste the
  id from the respective library page).
- Export Bundle's actual zip packaging (records an asset-id manifest only).
- `Script Builder` — explicitly out of scope per AGENTS.md.

## Smoke tests run during implementation (not part of the codebase — ad hoc verification against real local infra, then deleted)

1. Asset Library: create folder → presigned PUT upload → confirm → presigned
   GET → content round-trip matched.
2. Workflow execution: two-node graph (`text_input` → `prompt_combiner`)
   executed via `runWorkflow()` directly against Postgres — correct
   topological resolution, correct run/run_step status transitions, correct
   resolved output value.
3. Canvas save (`saveCanvasAction`'s upsert+delete logic): caught and fixed a
   real bug where an unscoped `notInArray` delete would have wiped nodes
   across *every* workflow's pages, not just the page being saved. Verified
   the fix: cross-workflow isolation, in-place upsert on existing node ids,
   correctly scoped pruning of removed nodes.
4. Audit log write + runs-list workflow join, against real Postgres.

## Local dev

1. `cp .env.example .env` and fill in:
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (Google Cloud Console → APIs &
     Services → Credentials → OAuth client — Authorized JavaScript origin
     `http://localhost:3000`, Authorized redirect URI
     `http://localhost:3000/api/auth/callback/google`) and `AUTH_SECRET`
     (`npx auth secret`) — required for sign-in. **Confirmed working live**
     (real client id, correct PKCE redirect to accounts.google.com).
   - `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` + either
     `GOOGLE_APPLICATION_CREDENTIALS` (service account key file) or
     `gcloud auth application-default login` — required for Gemini
     image/TTS/Omni Flash/Veo generation *and* context
     embeddings/ingestion/retrieval, via Vertex AI. Auth reaches Vertex
     correctly; still needs `aiplatform.endpoints.predict` permission
     granted on the GCP project (see status above).
   - `ELEVENLABS_API_KEY` — required for the ElevenLabs voice model.
     **Confirmed working live.**
   - `ANYFAST_API_KEY` — required for Seedance/Seedream/Kling. Seedream
     **confirmed working live**; Seedance/Kling untested (real cost, not run
     without asking).
2. `npm run docker:up` — starts Postgres (pgvector), Redis, and MinIO.
   - Postgres is mapped to **host port 5433**, not 5432, because a native/
     Homebrew Postgres may already own 5432 on the dev machine — binding
     both to `localhost:5432` doesn't error on macOS, the native process
     just silently wins loopback connections, which surfaces as a confusing
     "role does not exist" error from drizzle. `DATABASE_URL` in
     `.env.example` already points at 5433.
   - MinIO's `superos-assets` bucket is auto-created by the `minio-init`
     one-shot container.
3. `npm run db:migrate` then `npm run db:seed` (reads `SEED_ALLOWED_EMAILS`
   from `.env`).
4. `npm run dev` for the web app. In separate terminals: `npm run
   worker:workflow` and `npm run worker:media` — nothing runs (queued runs
   just sit in Redis) without these.

## Auth flow notes

- Session strategy is JWT (no separate Auth.js adapter tables) — the `users`
  row is upserted directly from the `signIn` callback in
  `apps/web/src/lib/auth.ts`, keeping the schema exactly as specified in
  AGENTS.md §8.1 instead of adding Auth.js's own adapter schema on top.
- `signIn` returns `false` for emails not in `allowed_emails` — Auth.js never
  creates a session for them, which is stronger than checking authorization
  after the fact. `proxy.ts` re-checks `session.user.isAuthorized` anyway as
  defense in depth per AGENTS.md §12.3.
