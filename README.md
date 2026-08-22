# superOS Workflow Studio

Internal webapp for building, testing, and running `superOS` content-generation workflows.

The planning source of truth lives in:

- `AGENTS.md` — full product/build plan
- `CLAUDE.md` — lightweight bootstrap for coding agents

## Stack

- `Next.js` App Router, `React`, `TypeScript`, `Tailwind CSS`, `npm` workspaces
- `Auth.js` v5 with Google OAuth + authorized email allowlist
- `Postgres` + `pgvector` via `Drizzle ORM`
- `Redis` + `BullMQ` background workers
- `@xyflow/react` for the workflow canvas
- S3-compatible object storage (MinIO locally, Cloudflare R2 in production)

## Repo layout

```text
.
├── AGENTS.md
├── CLAUDE.md
├── apps/
│   └── web/                 # Next.js app: shell, Playground, Workflow, Asset Library, etc.
├── docs/
│   └── technical/README.md  # implementation status, local dev setup, design notes
├── packages/
│   ├── db/                  # Drizzle schema, migrations, seed
│   ├── shared/               # DataType/NodeType unions, node port catalogue
│   ├── model-registry/       # approved model list + shared pricing service
│   ├── storage/               # S3-compatible adapter (presigned + direct uploads)
│   ├── queue/                 # BullMQ queue definitions
│   ├── workflow-engine/       # generation adapters, graph executor, node runner
│   └── context-engine/        # superOS docs ingestion + pgvector retrieval
└── workers/
    ├── workflow/              # BullMQ worker: workflow graph execution
    └── media/                 # BullMQ worker: standalone (Playground) generation
```

## Status

All phases through Phase 8 are implemented (`Script Builder` excluded, per
scope — see `AGENTS.md`). See `docs/technical/README.md` for what's real vs.
deliberately stubbed (a few provider adapters have no verified public API
and throw a clear error instead of guessing), local dev setup, and notes
from the smoke tests run against real local Postgres/MinIO during build.

## Local dev

```sh
cp .env.example .env   # fill in secrets — see docs/technical/README.md
npm install
npm run docker:up      # Postgres + Redis + MinIO
npm run db:migrate
npm run db:seed
npm run dev             # web app
npm run worker:workflow # separate terminal
npm run worker:media    # separate terminal
```
