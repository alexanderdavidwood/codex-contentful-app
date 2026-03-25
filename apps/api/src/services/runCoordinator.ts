import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import type {
  CodexSessionConfig,
  ProjectRecord,
  RunArtifactBundle,
  RunRecord,
} from "@codex-builder/shared";

import { config } from "../config.js";
import type { RunnerAdapter } from "../runners/runnerAdapter.js";
import type { Store } from "../storage/store.js";

type RunEventPayload =
  | { type: "status"; runId: string; payload: string }
  | { type: "log"; runId: string; payload: string }
  | { type: "artifact"; runId: string; payload: RunArtifactBundle }
  | { type: "completed"; runId: string; payload: RunRecord }
  | { type: "error"; runId: string; payload: string };

function runCommand(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.on("exit", () => resolve(stdout.trim()));
    child.on("error", () => resolve(""));
  });
}

export class RunCoordinator {
  private readonly streams = new Map<string, EventEmitter>();

  constructor(private readonly store: Store, private readonly runner: RunnerAdapter) {}

  getStream(runId: string): EventEmitter {
    const existing = this.streams.get(runId);
    if (existing) {
      return existing;
    }

    const created = new EventEmitter();
    this.streams.set(runId, created);
    return created;
  }

  async startRun(project: ProjectRecord, prompt: string, model?: string): Promise<RunRecord> {
    const now = new Date().toISOString();
    const runId = randomUUID();
    const run: RunRecord = {
      id: runId,
      projectId: project.id,
      prompt,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      artifactBundle: {
        implementationSpec: "",
        gitDiff: "",
        runLogs: [],
        scanResults: [],
        testResults: [],
        buildResults: [],
        previewRelease: {
          syncedToContentful: false,
        },
        codexVersion: "unknown",
      },
    };

    await this.store.createRun(run);
    const stream = this.getStream(runId);
    stream.emit("event", { type: "status", runId, payload: "queued" } satisfies RunEventPayload);

    const session: CodexSessionConfig = {
      codexVersion: "codex-cli",
      model,
      cwd: project.workspacePath,
      repoRef: project.repoRef,
      policyProfileId: "default",
      sandboxProfile: "workspace-write",
      allowedTools: [],
      networkPolicy: "inherit",
      envSecretRefs: [],
    };

    const handle = await this.runner.startBatchRun(project.id, {
      runId,
      prompt,
      session,
    });

    run.status = "running";
    run.updatedAt = new Date().toISOString();
    await this.store.updateRun(run);
    stream.emit("event", { type: "status", runId, payload: "running" } satisfies RunEventPayload);

    handle.events.on("event", async (event) => {
      const line = JSON.stringify(event);
      run.artifactBundle.runLogs.push(line);
      run.updatedAt = new Date().toISOString();
      await this.store.updateRun(run);
      stream.emit("event", { type: "log", runId, payload: line } satisfies RunEventPayload);
    });

    handle.events.on("stderr", async (line) => {
      run.artifactBundle.runLogs.push(line);
      run.updatedAt = new Date().toISOString();
      await this.store.updateRun(run);
      stream.emit("event", { type: "log", runId, payload: line } satisfies RunEventPayload);
    });

    handle.events.on("error", async (error: Error) => {
      run.status = "failed";
      run.updatedAt = new Date().toISOString();
      run.artifactBundle.runLogs.push(error.message);
      await this.store.updateRun(run);
      stream.emit("event", { type: "error", runId, payload: error.message } satisfies RunEventPayload);
    });

    handle.events.on("finished", async ({ code, lastMessage, stderr }: { code: number; lastMessage: string; stderr: string }) => {
      run.status = code === 0 ? "succeeded" : "failed";
      run.updatedAt = new Date().toISOString();
      run.artifactBundle.implementationSpec = lastMessage;
      run.artifactBundle.codexVersion = await runCommand(config.codexBin, ["--version"], project.workspacePath);
      run.artifactBundle.gitDiff = await runCommand("git", ["diff", "--no-ext-diff"], project.workspacePath);
      if (stderr) {
        run.artifactBundle.runLogs.push(stderr);
      }
      run.artifactBundle.scanResults = await this.createScanResults(project);
      await this.store.updateRun(run);
      stream.emit("event", { type: "artifact", runId, payload: run.artifactBundle } satisfies RunEventPayload);
      stream.emit("event", { type: "completed", runId, payload: run } satisfies RunEventPayload);
    });

    return run;
  }

  async cancelRun(runId: string): Promise<void> {
    await this.runner.interruptRun(runId);
  }

  private async createScanResults(project: ProjectRecord): Promise<RunArtifactBundle["scanResults"]> {
    const manifestPath = path.join(project.workspacePath, ".codex-contentful", "project.json");
    const manifestExists = await readFile(manifestPath, "utf8")
      .then(() => true)
      .catch(() => false);
    const diffStat = await runCommand("git", ["diff", "--stat"], project.workspacePath);
    return [
      {
        name: "manifest-contract",
        status: manifestExists ? "passed" : "failed",
        summary: manifestExists
          ? "Managed project manifest is present."
          : "Managed project manifest is missing.",
      },
      {
        name: "change-summary",
        status: diffStat ? "passed" : "skipped",
        summary: diffStat || "No git diff summary available.",
      },
    ];
  }
}
