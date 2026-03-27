# Contentful Installation

This MVP supports two installation patterns for the frontend:

- `Render static site`
- `Contentful app hosting` using the built `apps/contentful-app/dist` bundle

If Contentful cannot reliably load the Render-hosted frontend, use `Contentful app hosting` as the default path.

## Build the frontend bundle

```bash
npm run build --workspace @codex-builder/contentful-app
```

The resulting bundle is in `apps/contentful-app/dist` and includes `index.html` at the root, which is required for Contentful app hosting.

## Recommended path: Contentful app hosting

The repository now includes an upload script:

```bash
npm run upload:app
```

That command:

1. builds the frontend bundle
2. reads the required `CONTENTFUL_*` environment variables
3. runs `@contentful/app-scripts upload --ci`
3. uploads the built app bundle to your private app definition's hosting

You will need these variables available in your shell when you run it:

- `CONTENTFUL_ORG_ID`
- `CONTENTFUL_APP_DEF_ID`
- `CONTENTFUL_ACCESS_TOKEN`
- optional: `CONTENTFUL_HOST` for EU hostnames
- optional: `CONTENTFUL_BUNDLE_COMMENT`

If you open the deployed frontend outside Contentful, it now shows a standalone landing page instead of a blank screen. That page is only a deployment check; the real app UI appears once Contentful loads it inside an iframe.

When hosting the frontend on Render, keep the Render static-site headers aligned with Contentful embedding. The included `render.yaml` sets `Content-Security-Policy: frame-ancestors` for `https://app.contentful.com` and `https://app.eu.contentful.com`.

## Create the private app definition

In your Contentful organization settings:

1. Create a new private app definition.
2. Set the app name to `Codex Builder`.
3. Configure these locations:
   - `App configuration`
   - `Page`
4. Choose one hosting mode:
   - `Public URL`: use the Render static site URL
   - `Contentful app hosting`: preferred; upload the contents of `apps/contentful-app/dist`

## Switching from Render frontend hosting to Contentful app hosting

1. Keep the API deployed on Render.
2. Stop using the Render static site URL in the Contentful app definition.
3. Build or upload the frontend bundle:

```bash
npm run upload:app
```

4. In the Contentful private app definition, switch hosting to `Contentful app hosting`.
5. Upload the `dist` bundle if you are doing it manually in the UI, or let the upload script update the hosted bundle.
6. Reopen the app inside Contentful.
7. In the app configuration screen, set `API base URL` to the Render API URL.

## Install the app in a space

1. Install the private app into your target space and environment.
2. In the `ConfigScreen`, work through the setup cards in this order:
   - `API base URL` to the public URL of the Render API service
   - click `Check backend connection`
   - click `Install and authorize GitHub`
   - complete the GitHub App installation
   - if testing organization repos, choose the target organization here
   - if testing personal repos, choose the personal account that should own repos
   - complete the GitHub user authorization step in the same popup
   - optionally add an OpenAI secret reference for operator bookkeeping
   - confirm `Preview target` and `Production target`
   - expand `Advanced settings` only if you need tenant or recovery controls
3. Use the right-hand setup status rail to confirm the builder is `Ready`.
4. Save the installation.

What success looks like in the GitHub card:

- connection status is `Connected`
- owner login is shown
- owner type is `Organization` or `User`
- authorized GitHub user is shown
- auth mode is:
  - `installation` for organizations
  - `user` for personal accounts

The config screen now allows partial save, but the page location stays blocked until:

- backend checks pass
- GitHub is connected and authorized
- the backend reports `OPENAI_API_KEY`
- preview and production targets are set

## If you want to upload manually instead of using the script

1. Run:

```bash
npm run build --workspace @codex-builder/contentful-app
```

2. In Contentful app hosting, upload the contents of `apps/contentful-app/dist`.
3. Publish or save the hosted bundle in the app definition.
4. Reinstall or reopen the app in your target space.

## Source-of-truth metadata

The file `apps/contentful-app/contentful-private-app.template.json` is a repository-local template that captures the intended locations, install parameters, and hosting expectations for manual Contentful setup.

It is not an official Contentful import artifact.
