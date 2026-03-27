import { randomUUID } from "node:crypto";

import express from "express";
import cors from "cors";
import {
  bootstrapRequestSchema,
  configStatusRequestSchema,
  createProjectRequestSchema,
  createRunRequestSchema,
  createRunResponseSchema,
  disconnectGitHubRequestSchema,
  gitHubConnectSessionRequestSchema,
  gitHubConnectSessionStatusResponseSchema,
  projectDetailResponseSchema,
  projectRecordSchema,
  promotionRequestSchema,
  type TenantInstallationConfig,
} from "@codex-builder/shared";

import { config } from "./config.js";
import { OpenAICodexRunner } from "./runners/openAiCodexRunner.js";
import { ConfigStatusService } from "./services/configStatusService.js";
import { GitHubAppService } from "./services/githubAppService.js";
import { RunCoordinator } from "./services/runCoordinator.js";
import { scaffoldManagedProjectWorkspace } from "./services/projectScaffolder.js";
import { createStore } from "./storage/index.js";

const store = createStore();
const runner = new OpenAICodexRunner();
const coordinator = new RunCoordinator(store, runner);
const configStatusService = new ConfigStatusService(store, runner);
const gitHubAppService = new GitHubAppService(store);

async function decorateInstallationWithGitHubConnection(
  installation: TenantInstallationConfig,
): Promise<TenantInstallationConfig> {
  const connection = await store.getGitHubConnectionByTenant(installation.tenantId);
  if (!connection) {
    return installation;
  }

  return {
    ...installation,
    githubConnectionStatus: connection.status,
    githubInstallationId: connection.installationId ?? installation.githubInstallationId,
    githubOwnerLogin: connection.ownerLogin ?? installation.githubOwnerLogin,
    githubOwnerType: connection.ownerType ?? installation.githubOwnerType,
  };
}

export async function createApp() {
  await store.init();

  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed by CORS."));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      apiBaseUrl: config.defaultApiBaseUrl,
      environment: config.nodeEnv,
      storage: config.databaseUrl ? "postgres" : "memory",
      corsOrigins: config.corsOrigins,
      githubConfigured: gitHubAppService.isConfigured(),
      openAiConfigured: config.openAiApiKeyConfigured,
      runnerCapabilities: runner.getCapabilities(),
    });
  });

  app.post("/v1/installations/bootstrap", async (request, response) => {
    const parsed = bootstrapRequestSchema.parse(request.body);
    const installation = await decorateInstallationWithGitHubConnection(parsed.installation);
    await store.upsertInstallation(installation);
    const projects = await store.listProjects(installation.tenantId);
    response.json({
      installation,
      projects,
    });
  });

  app.post("/v1/config/status", async (request, response) => {
    const parsed = configStatusRequestSchema.parse(request.body);
    response.json(await configStatusService.getStatus(parsed.installation));
  });

  app.post("/v1/config/github/connect-session", async (request, response) => {
    const parsed = gitHubConnectSessionRequestSchema.parse(request.body);
    response.status(201).json(await gitHubAppService.createConnectSession(parsed));
  });

  app.get("/v1/config/github/connect-session/:sessionId", async (request, response) => {
    response.json(
      gitHubConnectSessionStatusResponseSchema.parse(
        await gitHubAppService.getConnectSessionStatus(request.params.sessionId),
      ),
    );
  });

  app.get("/v1/config/github/status", async (request, response) => {
    const tenantId = `${request.query.tenantId ?? ""}`.trim();
    if (!tenantId) {
      response.status(400).json({ error: "tenantId query parameter is required." });
      return;
    }

    response.json(await gitHubAppService.getConnectionStatus(tenantId));
  });

  app.post("/v1/config/github/disconnect", async (request, response) => {
    const parsed = disconnectGitHubRequestSchema.parse(request.body);
    const connection = await gitHubAppService.disconnect(parsed.tenantId);
    const installation = await store.getInstallation(parsed.tenantId);
    if (installation) {
      await store.upsertInstallation({
        ...installation,
        githubConnectionStatus: "disconnected",
        githubInstallationId: undefined,
        githubOwnerLogin: undefined,
        githubOwnerType: undefined,
      });
    }

    response.json(connection);
  });

  app.get("/v1/oauth/github/callback", async (request, response) => {
    const result = await gitHubAppService.handleCallback({
      installationId: `${request.query.installation_id ?? ""}`.trim() || undefined,
      setupAction: `${request.query.setup_action ?? ""}`.trim() || undefined,
      state: `${request.query.state ?? ""}`.trim() || undefined,
    });

    if (result.type === "connected") {
      const safeTitle = "GitHub connected";
      const safeMessage = "You can return to Contentful. This window will close automatically if it was opened as a popup.";
      response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle}</title>
  </head>
  <body style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px;">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <script>
      window.opener?.postMessage({ type: "codex-builder:github-connected", sessionId: "${result.session.id}" }, "*");
      window.setTimeout(() => window.close(), 600);
    </script>
  </body>
</html>`);
      return;
    }

    response.status(400).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${result.title}</title>
  </head>
  <body style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px;">
    <h1>${result.title}</h1>
    <p>${result.message}</p>
    <script>
      window.opener?.postMessage({ type: "codex-builder:github-failed" }, "*");
    </script>
  </body>
</html>`);
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

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      error: error.message,
    });
  });

  return app;
}
