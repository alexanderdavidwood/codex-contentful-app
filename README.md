# Codex-Powered Contentful App Builder

This repository implements the stage-1 MVP from the plan:

- a Contentful app with `ConfigScreen` and `Page`
- a Node API compatible with a Render-style single-service deployment
- a guided Forma 36 config experience with backend checks, GitHub App connection flow, and page-level setup gating
- a shared contract package for the builder UI, backend, and managed project manifest
- an `openai/codex`-backed runner adapter that can execute batch runs today and exposes an interactive session bridge for later work
- Render deployment assets for a testable next-stage deploy

## Workspaces

- `apps/api` - MVP backend with SSE run streaming and Postgres-ready storage
- `apps/contentful-app` - Contentful builder UI
- `packages/shared` - contracts, schemas, and manifest helpers

## Deployment assets

- `render.yaml` - Render blueprint for the MVP API, static site, and free Postgres database
- `apps/api/Dockerfile` - Docker image that installs `@openai/codex` and boots the API service
- `apps/contentful-app/contentful-private-app.template.json` - source-of-truth install metadata for manual Contentful app setup
- `docs/deploy-render.md` - Render deployment walkthrough
- `docs/install-contentful.md` - Contentful installation walkthrough

For Contentful app hosting, use:

```bash
npm run upload:app
```

That builds `apps/contentful-app/dist` and runs `@contentful/app-scripts upload`.

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
- `CORS_ORIGIN` - optional comma-separated allowlist of browser origins for deployed frontends
- `OPENAI_API_KEY` - required for headless or deployed Codex usage
- `GITHUB_APP_ID` - GitHub App ID used for the guided connect flow
- `GITHUB_APP_NAME` - GitHub App slug, used to build the installation URL
- `GITHUB_APP_PRIVATE_KEY` - PEM private key for GitHub App authentication
- `GITHUB_APP_BASE_URL` - optional override for GitHub host, defaults to `https://github.com`
- `GITHUB_API_BASE_URL` - optional override for GitHub API host, defaults to `https://api.github.com`
- `GITHUB_CONNECT_SESSION_TTL_MS` - optional TTL for GitHub connect sessions, defaults to 10 minutes

### Contentful app

- `VITE_API_BASE_URL` - default backend URL shown in the config screen

## GitHub App setup

The MVP config screen now expects a real GitHub App installation flow instead of a manual installation ID field.

Minimum GitHub App expectations:

- install with `selected repositories` access
- repository metadata: read
- repository contents: read and write
- pull requests: optional for later PR-based workflows
- callback URL pointing to `<your-api-base-url>/v1/oauth/github/callback`

The config screen will:

- create a short-lived connect session on the backend
- open the GitHub App installation flow
- poll the backend until the installation completes
- show the connected owner, installation ID, and repository-selection scope

If the GitHub popup is blocked, the config screen exposes a fallback link to continue the install flow in a new tab.

## MVP limitations

- The fallback in-memory store is intended for local development only.
- Managed projects are created locally on disk under `.runtime/projects`.
- Dependency and secret scanning are represented in the artifact model, but only basic file-diff inspection is implemented in stage 1.
- The interactive `codex app-server` bridge is present behind the runner abstraction, but the UI currently uses the simpler batch-run path.
- Render free-tier deployment is suitable only for smoke testing and internal demos.
- The config screen is instructions-first for OpenAI and deployment secrets. The backend still owns secret storage in this phase.
