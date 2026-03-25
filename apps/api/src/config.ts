import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL,
  codexBin: process.env.CODEX_BIN ?? "codex",
  codexModel: process.env.CODEX_MODEL,
  managedProjectRoot: process.env.MANAGED_PROJECT_ROOT ?? path.join(repoRoot, ".runtime/projects"),
  defaultApiBaseUrl: process.env.API_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`,
};
