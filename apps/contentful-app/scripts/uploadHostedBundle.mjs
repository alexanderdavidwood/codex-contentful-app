import { spawn } from "node:child_process";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const orgId = requireEnv("CONTENTFUL_ORG_ID");
const definitionId = requireEnv("CONTENTFUL_APP_DEF_ID");
const token = requireEnv("CONTENTFUL_ACCESS_TOKEN");
const host = process.env.CONTENTFUL_HOST ?? "api.contentful.com";
const comment = process.env.CONTENTFUL_BUNDLE_COMMENT ?? "Codex Builder hosted bundle upload";

const args = [
  "@contentful/app-scripts",
  "upload",
  "--ci",
  "--bundle-dir",
  "dist",
  "--organization-id",
  orgId,
  "--definition-id",
  definitionId,
  "--token",
  token,
  "--comment",
  comment,
  "--host",
  host,
];

const child = spawn("npx", args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
