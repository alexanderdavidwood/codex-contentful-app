# Codex-Powered Contentful App Builder

This repository implements the stage-1 MVP from the plan:

- a Contentful app with `ConfigScreen` and `Page`
- a Node API compatible with a Render-style single-service deployment
- a shared contract package for the builder UI, backend, and managed project manifest
- an `openai/codex`-backed runner adapter that can execute batch runs today and exposes an interactive session bridge for later work

## Workspaces

- `apps/api` - MVP backend with SSE run streaming and Postgres-ready storage
- `apps/contentful-app` - Contentful builder UI
- `packages/shared` - contracts, schemas, and manifest helpers

## Local development

```bash
npm install
npm run dev:api
npm run dev:app
```

## Required environment variables

### API

- `PORT` - API port, defaults to `8787`
- `DATABASE_URL` - optional Postgres connection string; without it the API falls back to in-memory storage
- `CODEX_BIN` - optional path to the `codex` binary
- `CODEX_MODEL` - optional model override for batch runs
- `MANAGED_PROJECT_ROOT` - optional filesystem root for generated managed projects

### Contentful app

- `VITE_API_BASE_URL` - default backend URL shown in the config screen

## MVP limitations

- The fallback in-memory store is intended for local development only.
- Managed projects are created locally on disk under `.runtime/projects`.
- Dependency and secret scanning are represented in the artifact model, but only basic file-diff inspection is implemented in stage 1.
- The interactive `codex app-server` bridge is present behind the runner abstraction, but the UI currently uses the simpler batch-run path.
