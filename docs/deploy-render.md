# Render Deployment

This repository includes a stage-1 Render blueprint in `render.yaml`.

The blueprint explicitly disables Render preview environments because Hobby workspaces do not support them.

## What gets created

- `codex-contentful-app-api` as a free Docker web service
- `codex-contentful-app-ui` as a free static site
- `codex-contentful-app-db` as a free Postgres database

## Before you deploy

1. Make sure the GitHub repo branch you want Render to track contains:
   - `render.yaml`
   - `apps/api/Dockerfile`
   - this monorepo workspace
2. Have an OpenAI API key ready for the backend service.
3. Decide whether you want to host the frontend on:
   - Render static hosting, or
   - Contentful app hosting by uploading `apps/contentful-app/dist`

## Deploy with a Render Blueprint

1. In Render, create a new Blueprint and point it at this repository.
2. During the initial setup, provide `OPENAI_API_KEY` when Render prompts for it.
3. Let Render create the API service, static site, and Postgres database.
4. After the first deploy, open the API service and copy its public URL.
5. In Contentful, create a private app definition and use either:
   - the Render static site URL as the frontend URL, or
   - the built `dist/` directory uploaded via Contentful app hosting
6. In the app's `ConfigScreen`, set the API base URL to the Render API URL.

## Important Render limitations for this MVP

- The free web service spins down after 15 minutes of idle time and takes roughly a minute to spin back up.
- The API service filesystem is ephemeral; managed project workspaces are not durable.
- The free Postgres database expires after 30 days unless upgraded.
- Free services are suitable for testing only, not production.

## Recommended environment variables

### Required

- `OPENAI_API_KEY`

### Optional

- `CODEX_MODEL`
  - defaults to `gpt-5.3-codex` in `render.yaml`
- `CORS_ORIGIN`
  - leave empty for the MVP to allow all origins
  - tighten later to your Contentful and static-site origins

## Smoke test after deploy

1. Visit the API `/health` endpoint.
2. Open the static site URL and confirm it loads.
3. Install the private app in Contentful and save the API base URL in `ConfigScreen`.
4. Create a managed project from the `Page` location.
5. Run a short prompt and confirm logs stream back into the UI.
