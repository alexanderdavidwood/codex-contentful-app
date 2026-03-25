import { EventEmitter } from "node:events";

import type { CodexSessionConfig } from "@codex-builder/shared";

export type RunnerCapabilities = {
  supportsInteractiveSessions: boolean;
  supportsBatchRuns: boolean;
};

export type InteractiveSessionHandle = {
  sessionId: string;
  events: EventEmitter;
  send(message: unknown): void;
  close(): void;
};

export type BatchRunHandle = {
  runId: string;
  events: EventEmitter;
  cancel(): void;
};

export type BatchRunRequest = {
  runId: string;
  prompt: string;
  session: CodexSessionConfig;
};

export interface RunnerAdapter {
  startInteractiveSession(projectId: string, session: CodexSessionConfig): Promise<InteractiveSessionHandle>;
  startBatchRun(projectId: string, request: BatchRunRequest): Promise<BatchRunHandle>;
  interruptRun(runId: string): Promise<void>;
  getCapabilities(): RunnerCapabilities;
}
