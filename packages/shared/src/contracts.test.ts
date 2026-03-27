import test from "node:test";
import assert from "node:assert/strict";

import {
  configStatusResponseSchema,
  createDefaultManifest,
  gitHubConnectSessionSchema,
  gitHubUserAuthRecordSchema,
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
    githubAuthMode: "installation",
    githubUserId: "42",
    githubUserLogin: "alex",
    githubUserAuthorizationStatus: "authorized",
    githubTokenExpiresAt: "2026-03-27T10:00:00.000Z",
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

test("tenant installation config normalizes empty optional strings", () => {
  const parsed = tenantInstallationConfigSchema.parse({
    tenantId: "internal-demo",
    githubInstallationId: "",
    githubOwnerLogin: "",
    githubConnectionStatus: "disconnected",
    githubUserId: "",
    githubUserLogin: "",
    githubUserAuthorizationStatus: "missing",
    openAiSecretRef: "",
    previewTarget: "contentful-preview",
    productionTarget: "contentful-production",
    policyProfileId: "default",
    apiBaseUrl: "https://codex-contentful-app-api.onrender.com",
    featureFlags: {
      enablePreviewSync: true,
    },
  });

  assert.equal(parsed.githubInstallationId, undefined);
  assert.equal(parsed.githubOwnerLogin, undefined);
  assert.equal(parsed.githubUserId, undefined);
  assert.equal(parsed.githubUserLogin, undefined);
  assert.equal(parsed.openAiSecretRef, undefined);
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
      githubUserAuthConfigured: true,
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
      authMode: "installation",
      githubUserId: "42",
      githubUserLogin: "alex",
      userAuthorizationStatus: "authorized",
      tokenExpiresAt: "2026-03-27T10:00:00.000Z",
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

test("github connect session schema accepts install and oauth state", () => {
  const parsed = gitHubConnectSessionSchema.parse({
    id: "session-1",
    tenantId: "internal-demo",
    contentfulContext: {
      organizationId: "org-1",
      appId: "app-1",
      environmentId: "master",
      spaceId: "space-1",
      userId: "user-1",
    },
    status: "pending",
    authorizationStatus: "awaiting_authorization",
    installState: "install-state",
    oauthState: "oauth-state",
    pkceVerifier: "pkce-verifier",
    returnUrl: "https://app.contentful.com",
    createdAt: "2026-03-27T09:00:00.000Z",
    updatedAt: "2026-03-27T09:00:00.000Z",
    expiresAt: "2026-03-27T09:10:00.000Z",
    pendingInstallationId: "12345",
  });

  assert.equal(parsed.authorizationStatus, "awaiting_authorization");
  assert.equal(parsed.pendingInstallationId, "12345");
});

test("github user auth record schema accepts encrypted token fields", () => {
  const parsed = gitHubUserAuthRecordSchema.parse({
    tenantId: "internal-demo",
    githubUserId: "42",
    githubUserLogin: "alex",
    installationId: "12345",
    accessTokenEncrypted: "iv.tag.ciphertext",
    refreshTokenEncrypted: "iv.tag.ciphertext",
    accessTokenExpiresAt: "2026-03-27T09:30:00.000Z",
    refreshTokenExpiresAt: "2026-04-27T09:30:00.000Z",
    createdAt: "2026-03-27T09:00:00.000Z",
    updatedAt: "2026-03-27T09:00:00.000Z",
  });

  assert.equal(parsed.githubUserLogin, "alex");
  assert.equal(parsed.installationId, "12345");
});
