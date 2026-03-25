# Repository Rules

- Inspect each workspace `package.json` before adding dependencies or scripts.
- Keep the builder app aligned with official Contentful libraries: `@contentful/app-sdk`, `@contentful/react-apps-toolkit`, and Forma 36.
- Treat `openai/codex` as a server-side runtime only. Do not expose Codex credentials or execution to the browser.
- Keep the stage-1 backend Render-compatible: one API service, one Postgres database, SSE for progress streaming, and no assumptions about durable local disk.
- Preserve the managed project contract in `.codex-contentful/project.json`.
- Prefer small, testable slices. Typecheck and build each workspace before broader validation.
