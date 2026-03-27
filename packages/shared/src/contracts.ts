import { z } from "zod";

export const supportedSurfaceSchema = z.enum([
  "ConfigScreen",
  "Page",
  "Sidebar",
  "Dialog",
  "Field",
  "EntryEditor",
]);

export const managedProjectManifestSchema = z.object({
  manifestVersion: z.literal("1.0"),
  appName: z.string().min(1),
  supportedSurfaces: z.array(supportedSurfaceSchema).min(1),
  scripts: z.object({
    dev: z.string(),
    typecheck: z.string(),
    test: z.string(),
    build: z.string(),
    previewSmoke: z.string(),
    deployPreview: z.string(),
    deployProd: z.string(),
  }),
  nodeVersion: z.string().min(1),
  hosting: z.object({
    provider: z.string().min(1),
    previewBaseUrl: z.string().url(),
    productionBaseUrl: z.string().url(),
  }),
  contentfulDefinition: z.object({
    organizationId: z.string().optional(),
    previewSpaceId: z.string().optional(),
    previewEnvironmentId: z.string().optional(),
  }),
  previewPolicy: z.object({
    requiresApproval: z.boolean(),
    syncToContentful: z.boolean(),
  }),
  dependencyPolicy: z.object({
    mode: z.literal("open-npm-with-scans"),
    blockOnLicenseFailure: z.boolean(),
    blockOnVulnerabilityFailure: z.boolean(),
    blockOnSecretDetection: z.boolean(),
  }),
});

export type ManagedProjectManifest = z.infer<typeof managedProjectManifestSchema>;

export const tenantInstallationConfigSchema = z.object({
  tenantId: z.string().min(1),
  githubInstallationId: z.string().min(1).optional(),
  githubOwnerLogin: z.string().min(1).optional(),
  githubOwnerType: z.enum(["Organization", "User"]).optional(),
  githubConnectionStatus: z.enum(["disconnected", "pending", "connected", "error"]).optional(),
  openAiSecretRef: z.string().min(1).optional(),
  previewTarget: z.string().min(1),
  productionTarget: z.string().min(1),
  policyProfileId: z.string().min(1),
  apiBaseUrl: z.string().url(),
  featureFlags: z.record(z.boolean()).default({}),
});

export type TenantInstallationConfig = z.infer<typeof tenantInstallationConfigSchema>;

export const contentfulContextSchema = z.object({
  organizationId: z.string().min(1),
  appId: z.string().min(1).optional(),
  environmentId: z.string().min(1),
  spaceId: z.string().min(1),
  userId: z.string().min(1),
});

export type ContentfulContext = z.infer<typeof contentfulContextSchema>;

export const gitHubConnectionStatusSchema = z.object({
  status: z.enum(["disconnected", "pending", "connected", "error"]),
  installationId: z.string().min(1).optional(),
  ownerLogin: z.string().min(1).optional(),
  ownerType: z.enum(["Organization", "User"]).optional(),
  repositorySelection: z.enum(["selected", "all"]).optional(),
  connectedAt: z.string().datetime().optional(),
  errorCode: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
});

export type GitHubConnectionStatus = z.infer<typeof gitHubConnectionStatusSchema>;

export const gitHubConnectSessionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  contentfulContext: contentfulContextSchema,
  status: z.enum(["pending", "connected", "failed", "expired"]),
  stateNonce: z.string().min(1),
  returnUrl: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  installationId: z.string().min(1).optional(),
  ownerLogin: z.string().min(1).optional(),
  ownerType: z.enum(["Organization", "User"]).optional(),
  errorCode: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
});

export type GitHubConnectSession = z.infer<typeof gitHubConnectSessionSchema>;

export const gitHubConnectSessionRequestSchema = z.object({
  tenantId: z.string().min(1),
  apiBaseUrl: z.string().url(),
  contentfulContext: contentfulContextSchema,
  returnUrl: z.string().url(),
});

export type GitHubConnectSessionRequest = z.infer<typeof gitHubConnectSessionRequestSchema>;

export const gitHubConnectSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  connectUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});

export type GitHubConnectSessionResponse = z.infer<typeof gitHubConnectSessionResponseSchema>;

export const gitHubConnectSessionStatusResponseSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(["pending", "connected", "failed", "expired"]),
  connection: gitHubConnectionStatusSchema.optional(),
  errorCode: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
});

export type GitHubConnectSessionStatusResponse = z.infer<typeof gitHubConnectSessionStatusResponseSchema>;

export const disconnectGitHubRequestSchema = z.object({
  tenantId: z.string().min(1),
});

export type DisconnectGitHubRequest = z.infer<typeof disconnectGitHubRequestSchema>;

export const configCheckKeySchema = z.enum([
  "backend",
  "github",
  "openai",
  "previewTarget",
  "productionTarget",
]);

export const configCheckResultSchema = z.object({
  key: configCheckKeySchema,
  label: z.string().min(1),
  status: z.enum(["passed", "failed", "warning", "missing"]),
  summary: z.string().min(1),
  details: z.string().min(1).optional(),
});

export type ConfigCheckResult = z.infer<typeof configCheckResultSchema>;

export const configStatusRequestSchema = z.object({
  installation: tenantInstallationConfigSchema,
});

export type ConfigStatusRequest = z.infer<typeof configStatusRequestSchema>;

export const configStatusResponseSchema = z.object({
  backend: z.object({
    status: z.enum(["passed", "failed", "warning", "missing"]),
    apiBaseUrl: z.string().url(),
    environment: z.string().min(1).optional(),
    storage: z.string().min(1).optional(),
    openAiConfigured: z.boolean(),
    githubConfigured: z.boolean(),
    runnerCapabilities: z.object({
      interactiveSessions: z.boolean(),
      batchRuns: z.boolean(),
      approvals: z.boolean(),
      diffArtifacts: z.boolean(),
    }),
    summary: z.string().min(1),
  }),
  github: gitHubConnectionStatusSchema,
  openai: z.object({
    status: z.enum(["passed", "failed", "warning", "missing"]),
    configured: z.boolean(),
    summary: z.string().min(1),
  }),
  targets: z.object({
    previewTarget: z.object({
      status: z.enum(["passed", "missing"]),
      summary: z.string().min(1),
    }),
    productionTarget: z.object({
      status: z.enum(["passed", "missing"]),
      summary: z.string().min(1),
    }),
  }),
  checks: z.array(configCheckResultSchema),
  overall: z.enum(["ready", "needs_setup", "blocked"]),
});

export type ConfigStatusResponse = z.infer<typeof configStatusResponseSchema>;

export const codexSessionConfigSchema = z.object({
  codexVersion: z.string().min(1),
  model: z.string().min(1).optional(),
  cwd: z.string().min(1),
  repoRef: z.string().min(1),
  policyProfileId: z.string().min(1),
  sandboxProfile: z.enum(["read-only", "workspace-write", "danger-full-access"]),
  allowedTools: z.array(z.string()).default([]),
  networkPolicy: z.enum(["inherit", "disabled"]),
  envSecretRefs: z.array(z.string()).default([]),
});

export type CodexSessionConfig = z.infer<typeof codexSessionConfigSchema>;

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const runArtifactBundleSchema = z.object({
  implementationSpec: z.string().default(""),
  gitDiff: z.string().default(""),
  runLogs: z.array(z.string()).default([]),
  scanResults: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["passed", "failed", "skipped"]),
      summary: z.string(),
    }),
  ),
  testResults: z.array(z.string()).default([]),
  buildResults: z.array(z.string()).default([]),
  previewRelease: z
    .object({
      url: z.string().url().optional(),
      syncedToContentful: z.boolean(),
    })
    .default({ syncedToContentful: false }),
  rollbackRef: z.string().optional(),
  codexVersion: z.string().min(1),
});

export type RunArtifactBundle = z.infer<typeof runArtifactBundleSchema>;

export const projectRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  workspacePath: z.string().min(1),
  repoRef: z.string().min(1),
  description: z.string().default(""),
  manifest: managedProjectManifestSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProjectRecord = z.infer<typeof projectRecordSchema>;

export const runRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  prompt: z.string().min(1),
  status: runStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  artifactBundle: runArtifactBundleSchema,
});

export type RunRecord = z.infer<typeof runRecordSchema>;

export const createProjectRequestSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  supportedSurfaces: z.array(supportedSurfaceSchema).min(1),
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const createRunRequestSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().min(1).optional(),
});

export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;

export const bootstrapRequestSchema = z.object({
  installation: tenantInstallationConfigSchema,
});

export const bootstrapResponseSchema = z.object({
  installation: tenantInstallationConfigSchema,
  projects: z.array(projectRecordSchema),
});

export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;

export const projectDetailResponseSchema = z.object({
  project: projectRecordSchema,
  runs: z.array(runRecordSchema),
});

export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;

export const createRunResponseSchema = z.object({
  runId: z.string().min(1),
  status: runStatusSchema,
});

export type CreateRunResponse = z.infer<typeof createRunResponseSchema>;

export const promotionRequestSchema = z.object({
  approvalComment: z.string().min(1),
});

export const sseEventSchema = z.object({
  type: z.enum(["status", "log", "artifact", "completed", "error"]),
  runId: z.string().min(1),
  payload: z.unknown(),
});

export type SseEvent = z.infer<typeof sseEventSchema>;

export function createDefaultManifest(
  appName: string,
  supportedSurfaces: Array<z.infer<typeof supportedSurfaceSchema>>,
): ManagedProjectManifest {
  return {
    manifestVersion: "1.0",
    appName,
    supportedSurfaces,
    scripts: {
      dev: "node ./scripts/dev.mjs",
      typecheck: "node ./scripts/typecheck.mjs",
      test: "node ./scripts/test.mjs",
      build: "node ./scripts/build.mjs",
      previewSmoke: "node ./scripts/preview-smoke.mjs",
      deployPreview: "node ./scripts/deploy-preview.mjs",
      deployProd: "node ./scripts/deploy-prod.mjs",
    },
    nodeVersion: "22",
    hosting: {
      provider: "managed-external",
      previewBaseUrl: "https://preview.example.com",
      productionBaseUrl: "https://prod.example.com",
    },
    contentfulDefinition: {},
    previewPolicy: {
      requiresApproval: false,
      syncToContentful: true,
    },
    dependencyPolicy: {
      mode: "open-npm-with-scans",
      blockOnLicenseFailure: true,
      blockOnVulnerabilityFailure: true,
      blockOnSecretDetection: true,
    },
  };
}
