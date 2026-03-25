import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import type { ManagedProjectManifest, ProjectRecord } from "@codex-builder/shared";
import { createDefaultManifest } from "@codex-builder/shared";

import { config } from "../config.js";

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function writeExecutableScript(root: string, name: string, body: string): Promise<void> {
  const scriptPath = path.join(root, "scripts", `${name}.mjs`);
  await writeFile(scriptPath, body, "utf8");
}

export async function scaffoldManagedProjectWorkspace(
  projectId: string,
  name: string,
  description: string,
  supportedSurfaces: ManagedProjectManifest["supportedSurfaces"],
): Promise<ProjectRecord> {
  const workspacePath = path.join(config.managedProjectRoot, projectId);
  const manifest = createDefaultManifest(name, supportedSurfaces);

  await mkdir(path.join(workspacePath, ".codex-contentful"), { recursive: true });
  await mkdir(path.join(workspacePath, "scripts"), { recursive: true });
  await mkdir(path.join(workspacePath, "src"), { recursive: true });

  await writeFile(
    path.join(workspacePath, "README.md"),
    `# ${name}

${description || "Managed Contentful app workspace created by Codex Builder."}

This workspace is intentionally minimal in stage 1. The builder backend owns the manifest contract in \`.codex-contentful/project.json\`.
`,
    "utf8",
  );

  await writeFile(
    path.join(workspacePath, "package.json"),
    JSON.stringify(
      {
        name: projectId,
        private: true,
        version: "0.0.1",
        type: "module",
        scripts: {
          dev: "node ./scripts/dev.mjs",
          typecheck: "node ./scripts/typecheck.mjs",
          test: "node ./scripts/test.mjs",
          build: "node ./scripts/build.mjs",
          "preview:smoke": "node ./scripts/preview-smoke.mjs",
          "deploy:preview": "node ./scripts/deploy-preview.mjs",
          "deploy:prod": "node ./scripts/deploy-prod.mjs",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(workspacePath, ".codex-contentful", "project.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(workspacePath, "src", "entrypoint.ts"),
    `export function render() {
  return "${name}";
}
`,
    "utf8",
  );

  await writeExecutableScript(
    workspacePath,
    "dev",
    `console.log("Managed project dev script placeholder for ${name}.");\n`,
  );
  await writeExecutableScript(
    workspacePath,
    "typecheck",
    `console.log("Managed project typecheck placeholder.");\n`,
  );
  await writeExecutableScript(
    workspacePath,
    "test",
    `console.log("Managed project test placeholder.");\n`,
  );
  await writeExecutableScript(
    workspacePath,
    "build",
    `console.log("Managed project build placeholder.");\n`,
  );
  await writeExecutableScript(
    workspacePath,
    "preview-smoke",
    `console.log("Managed project preview smoke placeholder.");\n`,
  );
  await writeExecutableScript(
    workspacePath,
    "deploy-preview",
    `console.log("Managed project deploy preview placeholder.");\n`,
  );
  await writeExecutableScript(
    workspacePath,
    "deploy-prod",
    `console.log("Managed project deploy prod placeholder.");\n`,
  );

  try {
    await run("git", ["init", "-b", "main"], workspacePath);
    await run("git", ["add", "."], workspacePath);
    await run(
      "git",
      ["-c", "user.name=Codex Builder", "-c", "user.email=builder@example.com", "commit", "-m", "Initial managed project scaffold"],
      workspacePath,
    );
  } catch {
    // Local git initialization is a convenience for diff artifacts; the workspace can still function without it.
  }

  const now = new Date().toISOString();
  return {
    id: projectId,
    name,
    workspacePath,
    repoRef: `managed/${projectId}`,
    description,
    manifest,
    createdAt: now,
    updatedAt: now,
  };
}
