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
- `GITHUB_APP_ID`
- `GITHUB_APP_NAME`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

### Optional

- `CODEX_MODEL`
  - defaults to `gpt-5.3-codex` in `render.yaml`
- `CORS_ORIGIN`
  - leave empty for the MVP to allow all origins
  - tighten later to your Contentful and static-site origins
- `GITHUB_CONNECT_SESSION_TTL_MS`
  - defaults to 10 minutes
- `GITHUB_APP_BASE_URL`
  - defaults to `https://github.com`
- `GITHUB_API_BASE_URL`
  - defaults to `https://api.github.com`

## GitHub App callback

Set the GitHub App setup URL to:

```text
https://<your-render-api-host>/v1/oauth/github/setup
```

Set the GitHub App callback URL to:

```text
https://<your-render-api-host>/v1/oauth/github/callback
```

The config screen now starts a backend-owned GitHub connect session, opens the GitHub App install flow, then redirects the popup into GitHub user authorization. The backend validates the installation against the authorized user, stores encrypted user-token data, and uses installation tokens for organization repos or user tokens for personal repos.

## Manual GitHub App setup checklist

1. Open GitHub and go to `Settings -> Developer settings -> GitHub Apps`.
2. Click `New GitHub App`.
3. Create the GitHub App under your personal account for now.
2. Set:
   - `Homepage URL` to your repo or product URL
   - `Setup URL` to `https://<your-render-api-host>/v1/oauth/github/setup`
   - `Callback URL` to `https://<your-render-api-host>/v1/oauth/github/callback`
4. Choose installation settings that allow the app to be installed into other accounts you control.
5. Leave `Request user authorization (OAuth) during installation` disabled.
6. Set repository permissions:
   - `Metadata: Read-only`
   - `Contents: Read & write`
   - `Administration: Read & write`
7. Generate and save:
   - App ID
   - app slug
   - client ID
   - client secret
   - private key PEM
8. Generate a token encryption key:

```bash
openssl rand -base64 32
```

9. Put all required GitHub env vars into Render exactly as:
   - `GITHUB_APP_ID=<App ID>`
   - `GITHUB_APP_NAME=<app slug>`
   - `GITHUB_APP_CLIENT_ID=<Client ID>`
   - `GITHUB_APP_CLIENT_SECRET=<Client secret>`
   - `GITHUB_APP_PRIVATE_KEY=<full PEM contents>`
   - `GITHUB_TOKEN_ENCRYPTION_KEY=<openssl output>`
10. Redeploy the API service.
11. Confirm `/health` returns `githubConfigured: true` and `githubUserAuthConfigured: true`.

## Smoke test after deploy

1. Visit the API `/health` endpoint.
2. Upload the frontend with `npm run upload:app` or confirm your hosted bundle is current.
3. Install the private app in Contentful and complete the `ConfigScreen` checks.
4. Click `Install and authorize GitHub` in the config screen.
5. Choose the owner carefully:
   - for org testing, install into the organization that should own repos
   - for user testing, install into the personal account that should own repos
6. Confirm the popup completes both GitHub installation and user authorization.
7. Confirm the page location is unblocked.
8. Create a managed project from the `Page` location.
9. Confirm a private GitHub repository is created and the scaffold is pushed to `main`.
