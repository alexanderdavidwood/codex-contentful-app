import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const defaultBrowserOrigins = [
  "https://app.contentful.com",
  "https://app.eu.contentful.com",
];

export const config = {
  port: Number(process.env.PORT ?? 8787),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL,
  codexBin: process.env.CODEX_BIN ?? "codex",
  codexModel: process.env.CODEX_MODEL,
  managedProjectRoot: process.env.MANAGED_PROJECT_ROOT ?? path.join(repoRoot, ".runtime/projects"),
  defaultApiBaseUrl: process.env.API_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`,
  corsOrigins: [...new Set([...defaultBrowserOrigins, ...parseCsv(process.env.CORS_ORIGIN)])],
  secretRedactionValues: [
    process.env.OPENAI_API_KEY,
    process.env.CONTENTFUL_ACCESS_TOKEN,
    process.env.GITHUB_APP_PRIVATE_KEY,
    process.env.GITHUB_WEBHOOK_SECRET,
  ].filter((value): value is string => Boolean(value && value.trim())),
};
