# CLAUDE.md — superOS Workflow Studio Bootstrap

> Lightweight bootstrap file for Claude and other coding agents.
> The full product and build plan lives in `AGENTS.md`.

## Read This First

Before planning or implementing anything in this repo, read:

1. `AGENTS.md`

Do not assume this project is a generic AI playground. The source of truth is the `superOS`-specific plan in `AGENTS.md`.

## What `AGENTS.md` Covers

`AGENTS.md` contains the current source of truth for:

- product scope
- phased build plan
- system architecture
- workflow canvas requirements
- asset library requirements
- playground requirements
- `superOS` context requirements
- auth and internal-access rules
- explicit out-of-scope items

## Important Defaults

Unless the user explicitly changes direction, follow the defaults in `AGENTS.md`:

- internal tool only
- Google OAuth plus authorized-email allowlist
- `Next.js` App Router + `TypeScript` + `React Flow`
- `Auth.js` + `Drizzle ORM`
- `Postgres` + `pgvector`
- `Redis` + `BullMQ`
- `Cloudflare R2`
- shared model registry across `Playground` and `Workflow`
- initial model registry limited to the normalized production list in `AGENTS.md`, sourced from `superOS/Docs/marketing/production.md`
- shared asset system across uploads and generated outputs
- `superOS` context as a first-class system, not a later add-on

## Scope Guardrail

`Script Builder` is intentionally deferred.

Do not plan or implement `Script Builder` unless the user explicitly asks for that phase later.

## Why This File Is Small

This file stays lightweight on purpose so agents do not ingest the full planning document on every run. Use it as a pointer, not as a replacement for `AGENTS.md`.
