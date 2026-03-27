import type {
  ConfigCheckResult,
  ConfigStatusResponse,
  GitHubConnectionStatus,
  TenantInstallationConfig,
} from "@codex-builder/shared";

import { config } from "../config.js";
import type { RunnerAdapter } from "../runners/runnerAdapter.js";
import type { Store } from "../storage/store.js";

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim());
}

function buildGitHubCheckSummary(connection: GitHubConnectionStatus, gitHubConfigured: boolean) {
  if (!gitHubConfigured) {
    return {
      status: "warning" as const,
      summary: "GitHub App backend configuration is missing.",
      details: "Set GITHUB_APP_ID, GITHUB_APP_NAME, and GITHUB_APP_PRIVATE_KEY on the backend.",
    };
  }

  if (connection.status === "connected") {
    return {
      status: "passed" as const,
      summary: connection.ownerLogin
        ? `Connected to ${connection.ownerLogin}.`
        : "GitHub is connected.",
      details: connection.repositorySelection === "selected"
        ? "Repository access is scoped to selected repositories."
        : "Repository access is broader than selected repositories.",
    };
  }

  if (connection.status === "error") {
    return {
      status: "failed" as const,
      summary: connection.errorMessage ?? "GitHub connection is in an error state.",
      details: connection.errorCode,
    };
  }

  if (connection.status === "pending") {
    return {
      status: "warning" as const,
      summary: "GitHub connection is still pending.",
      details: "Finish the GitHub App install flow and reconnect if needed.",
    };
  }

  return {
    status: "missing" as const,
    summary: "GitHub is not connected yet.",
    details: "Use Connect GitHub to install the GitHub App into the target owner.",
  };
}

export class ConfigStatusService {
  constructor(
    private readonly store: Store,
    private readonly runner: RunnerAdapter,
  ) {}

  async getStatus(installation: TenantInstallationConfig): Promise<ConfigStatusResponse> {
    const gitHubConfigured = Boolean(
      config.gitHubAppId?.trim() &&
        config.gitHubAppName?.trim() &&
        config.gitHubAppPrivateKey?.trim(),
    );
    const gitHubConnection =
      (await this.store.getGitHubConnectionByTenant(installation.tenantId)) ?? ({
        status: "disconnected",
      } satisfies GitHubConnectionStatus);

    const gitHubCheck = buildGitHubCheckSummary(gitHubConnection, gitHubConfigured);
    const previewTargetConfigured = hasValue(installation.previewTarget);
    const productionTargetConfigured = hasValue(installation.productionTarget);

    const checks: ConfigCheckResult[] = [
      {
        key: "backend",
        label: "Backend",
        status: "passed",
        summary: "Backend is reachable and responded to the setup status request.",
        details: config.defaultApiBaseUrl !== installation.apiBaseUrl
          ? `Backend reported from ${installation.apiBaseUrl}.`
          : undefined,
      },
      {
        key: "github",
        label: "GitHub",
        status: gitHubCheck.status,
        summary: gitHubCheck.summary,
        details: gitHubCheck.details,
      },
      {
        key: "openai",
        label: "OpenAI",
        status: config.openAiApiKeyConfigured ? "passed" : "missing",
        summary: config.openAiApiKeyConfigured
          ? "OPENAI_API_KEY is configured on the backend."
          : "OPENAI_API_KEY is not configured on the backend.",
        details: config.openAiApiKeyConfigured
          ? undefined
          : "Set OPENAI_API_KEY on the Render API service for Codex execution.",
      },
      {
        key: "previewTarget",
        label: "Preview target",
        status: previewTargetConfigured ? "passed" : "missing",
        summary: previewTargetConfigured
          ? `Preview target is ${installation.previewTarget}.`
          : "Preview target is missing.",
      },
      {
        key: "productionTarget",
        label: "Production target",
        status: productionTargetConfigured ? "passed" : "missing",
        summary: productionTargetConfigured
          ? `Production target is ${installation.productionTarget}.`
          : "Production target is missing.",
      },
    ];

    const allPassed = checks.every((check) => check.status === "passed");
    const anyFailed = checks.some((check) => check.status === "failed");

    return {
      backend: {
        status: "passed",
        apiBaseUrl: installation.apiBaseUrl,
        environment: config.nodeEnv,
        storage: config.databaseUrl ? "postgres" : "memory",
        openAiConfigured: config.openAiApiKeyConfigured,
        githubConfigured: gitHubConfigured,
        runnerCapabilities: {
          interactiveSessions: this.runner.getCapabilities().supportsInteractiveSessions,
          batchRuns: this.runner.getCapabilities().supportsBatchRuns,
          approvals: this.runner.getCapabilities().supportsInteractiveSessions,
          diffArtifacts: true,
        },
        summary: "Backend reachable.",
      },
      github: gitHubConnection,
      openai: {
        status: config.openAiApiKeyConfigured ? "passed" : "missing",
        configured: config.openAiApiKeyConfigured,
        summary: config.openAiApiKeyConfigured
          ? "Backend can run Codex with the configured OpenAI key."
          : "Backend is missing OPENAI_API_KEY.",
      },
      targets: {
        previewTarget: {
          status: previewTargetConfigured ? "passed" : "missing",
          summary: previewTargetConfigured
            ? installation.previewTarget
            : "Preview target is required.",
        },
        productionTarget: {
          status: productionTargetConfigured ? "passed" : "missing",
          summary: productionTargetConfigured
            ? installation.productionTarget
            : "Production target is required.",
        },
      },
      checks,
      overall: allPassed ? "ready" : anyFailed ? "blocked" : "needs_setup",
    };
  }
}
