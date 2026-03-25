import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { CodexSessionConfig } from "@codex-builder/shared";

import { config } from "../config.js";
import type {
  BatchRunHandle,
  BatchRunRequest,
  InteractiveSessionHandle,
  RunnerAdapter,
  RunnerCapabilities,
} from "./runnerAdapter.js";

type RunningProcess = {
  child: ChildProcessWithoutNullStreams;
  events: EventEmitter;
  outputFile?: string;
  scratchDir?: string;
};

function consumeJsonLines(chunk: string, state: { buffer: string }): Array<Record<string, unknown>> {
  state.buffer += chunk;
  const lines = state.buffer.split("\n");
  state.buffer = lines.pop() ?? "";

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

export class OpenAICodexRunner implements RunnerAdapter {
  private readonly processes = new Map<string, RunningProcess>();

  getCapabilities(): RunnerCapabilities {
    return {
      supportsInteractiveSessions: true,
      supportsBatchRuns: true,
    };
  }

  async startInteractiveSession(_projectId: string, session: CodexSessionConfig): Promise<InteractiveSessionHandle> {
    const sessionId = randomUUID();
    const events = new EventEmitter();
    const args = [
      "app-server",
      "--listen",
      "stdio://",
      "-c",
      `sandbox_mode="${session.sandboxProfile}"`,
    ];

    const child = spawn(config.codexBin, args, {
      cwd: session.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      events.emit("stdout", chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk) => {
      events.emit("stderr", chunk.toString("utf8"));
    });
    child.on("exit", (code) => {
      events.emit("exit", code ?? 0);
      this.processes.delete(sessionId);
    });

    this.processes.set(sessionId, { child, events });

    return {
      sessionId,
      events,
      send(message: unknown) {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      },
      close: () => {
        child.kill("SIGTERM");
      },
    };
  }

  async startBatchRun(_projectId: string, request: BatchRunRequest): Promise<BatchRunHandle> {
    const events = new EventEmitter();
    const scratchDir = await mkdtemp(path.join(os.tmpdir(), "codex-builder-"));
    const outputFile = path.join(scratchDir, "last-message.txt");
    await mkdir(path.dirname(outputFile), { recursive: true });

    const args = [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--output-last-message",
      outputFile,
      "--sandbox",
      request.session.sandboxProfile,
      "--cd",
      request.session.cwd,
    ];

    if (request.session.model ?? config.codexModel) {
      args.push("--model", request.session.model ?? config.codexModel ?? "");
    }

    args.push(request.prompt);

    const child = spawn(config.codexBin, args, {
      cwd: request.session.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutState = { buffer: "" };
    let stderrBuffer = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      for (const event of consumeJsonLines(text, stdoutState)) {
        events.emit("event", event);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderrBuffer += text;
      events.emit("stderr", text);
    });

    child.on("error", (error) => {
      events.emit("error", error);
      this.processes.delete(request.runId);
    });

    child.on("exit", async (code) => {
      let lastMessage = "";
      try {
        lastMessage = await readFile(outputFile, "utf8");
      } catch {
        lastMessage = "";
      }

      events.emit("finished", {
        code: code ?? 0,
        lastMessage,
        stderr: stderrBuffer,
      });
      this.processes.delete(request.runId);
      await rm(scratchDir, { recursive: true, force: true });
    });

    this.processes.set(request.runId, { child, events, outputFile, scratchDir });

    return {
      runId: request.runId,
      events,
      cancel: () => {
        child.kill("SIGTERM");
      },
    };
  }

  async interruptRun(runId: string): Promise<void> {
    const processRef = this.processes.get(runId);
    processRef?.child.kill("SIGTERM");
  }
}
