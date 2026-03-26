# Contentful Installation

This MVP supports two installation patterns for the frontend:

- `Render static site`
- `Contentful app hosting` using the built `apps/contentful-app/dist` bundle

## Build the frontend bundle

```bash
npm run build --workspace @codex-builder/contentful-app
```

The resulting bundle is in `apps/contentful-app/dist` and includes `index.html` at the root, which is required for Contentful app hosting.

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
   - `Contentful app hosting`: upload the contents of `apps/contentful-app/dist`

## Install the app in a space

1. Install the private app into your target space and environment.
2. In the `ConfigScreen`, set:
   - `API base URL` to the public URL of the Render API service
   - `Tenant ID` to an internal tenant label
   - optional GitHub and OpenAI secret references if you want those values visible in the config model
3. Save the installation.

## Source-of-truth metadata

The file `apps/contentful-app/contentful-private-app.template.json` is a repository-local template that captures the intended locations, install parameters, and hosting expectations for manual Contentful setup.

It is not an official Contentful import artifact.
