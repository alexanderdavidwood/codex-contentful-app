import test from "node:test";
import assert from "node:assert/strict";

import {
  configStatusResponseSchema,
  createDefaultManifest,
  managedProjectManifestSchema,
  tenantInstallationConfigSchema,
} from "./contracts.js";

test("createDefaultManifest creates a valid managed project manifest", () => {
  const manifest = createDefaultManifest("Codex Builder Demo", ["Page", "Sidebar"]);
  const parsed = managedProjectManifestSchema.parse(manifest);

  assert.equal(parsed.appName, "Codex Builder Demo");
  assert.deepEqual(parsed.supportedSurfaces, ["Page", "Sidebar"]);
});

test("tenant installation config supports github connection metadata", () => {
  const parsed = tenantInstallationConfigSchema.parse({
    tenantId: "internal-demo",
    githubInstallationId: "12345",
    githubOwnerLogin: "acme-org",
    githubOwnerType: "Organization",
    githubConnectionStatus: "connected",
    openAiSecretRef: "render:OPENAI_API_KEY",
    previewTarget: "contentful-preview",
    productionTarget: "contentful-production",
    policyProfileId: "default",
    apiBaseUrl: "https://codex-contentful-app-api.onrender.com",
    featureFlags: {
      enablePreviewSync: true,
    },
  });

  assert.equal(parsed.githubOwnerLogin, "acme-org");
  assert.equal(parsed.githubConnectionStatus, "connected");
});

test("config status response schema accepts guided setup payloads", () => {
  const parsed = configStatusResponseSchema.parse({
    backend: {
      status: "passed",
      apiBaseUrl: "https://codex-contentful-app-api.onrender.com",
      environment: "production",
      storage: "postgres",
      openAiConfigured: true,
      githubConfigured: true,
      runnerCapabilities: {
        interactiveSessions: true,
        batchRuns: true,
        approvals: true,
        diffArtifacts: true,
      },
      summary: "Backend reachable.",
    },
    github: {
      status: "connected",
      installationId: "12345",
      ownerLogin: "acme-org",
      ownerType: "Organization",
      repositorySelection: "selected",
      connectedAt: "2026-03-26T10:00:00.000Z",
    },
    openai: {
      status: "passed",
      configured: true,
      summary: "Backend can run Codex with the configured OpenAI key.",
    },
    targets: {
      previewTarget: {
        status: "passed",
        summary: "contentful-preview",
      },
      productionTarget: {
        status: "passed",
        summary: "contentful-production",
      },
    },
    checks: [
      {
        key: "backend",
        label: "Backend",
        status: "passed",
        summary: "Backend is reachable.",
      },
    ],
    overall: "ready",
  });

  assert.equal(parsed.overall, "ready");
  assert.equal(parsed.github.ownerLogin, "acme-org");
});
