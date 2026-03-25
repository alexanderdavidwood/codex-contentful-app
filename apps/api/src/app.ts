import { randomUUID } from "node:crypto";

import express from "express";
import cors from "cors";
import {
  bootstrapRequestSchema,
  createProjectRequestSchema,
  createRunRequestSchema,
  createRunResponseSchema,
  projectDetailResponseSchema,
  projectRecordSchema,
  promotionRequestSchema,
} from "@codex-builder/shared";

import { config } from "./config.js";
import { OpenAICodexRunner } from "./runners/openAiCodexRunner.js";
import { RunCoordinator } from "./services/runCoordinator.js";
import { scaffoldManagedProjectWorkspace } from "./services/projectScaffolder.js";
import { createStore } from "./storage/index.js";

const store = createStore();
const runner = new OpenAICodexRunner();
const coordinator = new RunCoordinator(store, runner);

export async function createApp() {
  await store.init();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      apiBaseUrl: config.defaultApiBaseUrl,
      storage: config.databaseUrl ? "postgres" : "memory",
      runnerCapabilities: runner.getCapabilities(),
    });
  });

  app.post("/v1/installations/bootstrap", async (request, response) => {
    const parsed = bootstrapRequestSchema.parse(request.body);
    await store.upsertInstallation(parsed.installation);
    const projects = await store.listProjects(parsed.installation.tenantId);
    response.json({
      installation: parsed.installation,
      projects,
    });
  });

  app.post("/v1/projects", async (request, response) => {
    const parsed = createProjectRequestSchema.parse(request.body);
    const project = await scaffoldManagedProjectWorkspace(
      randomUUID(),
      parsed.name,
      parsed.description,
      parsed.supportedSurfaces,
    );

    projectRecordSchema.parse(project);
    await store.createProject(parsed.tenantId, project);
    response.status(201).json(project);
  });

  app.get("/v1/projects/:projectId", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    if (!project) {
      response.status(404).json({ error: "Project not found" });
      return;
    }

    const runs = await store.listRuns(project.id);
    response.json(
      projectDetailResponseSchema.parse({
        project,
        runs,
      }),
    );
  });

  app.post("/v1/projects/:projectId/runs", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    if (!project) {
      response.status(404).json({ error: "Project not found" });
      return;
    }

    const parsed = createRunRequestSchema.parse(request.body);
    const run = await coordinator.startRun(project, parsed.prompt, parsed.model);
    response.status(202).json(
      createRunResponseSchema.parse({
        runId: run.id,
        status: run.status,
      }),
    );
  });

  app.get("/v1/runs/:runId/stream", async (request, response) => {
    const run = await store.getRun(request.params.runId);
    if (!run) {
      response.status(404).json({ error: "Run not found" });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const emitter = coordinator.getStream(run.id);
    const listener = (event: unknown) => {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    emitter.on("event", listener);
    response.write(`data: ${JSON.stringify({ type: "status", runId: run.id, payload: run.status })}\n\n`);

    request.on("close", () => {
      emitter.off("event", listener);
      response.end();
    });
  });

  app.post("/v1/projects/:projectId/promotions", async (request, response) => {
    const project = await store.getProject(request.params.projectId);
    if (!project) {
      response.status(404).json({ error: "Project not found" });
      return;
    }

    const parsed = promotionRequestSchema.parse(request.body);
    response.json({
      ok: true,
      projectId: project.id,
      approvalComment: parsed.approvalComment,
      message: "Promotion flow is staged for manual review in the MVP.",
    });
  });

  app.post("/v1/webhooks/github", (request, response) => {
    response.status(202).json({
      accepted: true,
      event: request.header("x-github-event") ?? "unknown",
    });
  });

  return app;
}
