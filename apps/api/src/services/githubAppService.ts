import { createSign, randomUUID } from "node:crypto";

import type {
  GitHubConnectSession,
  GitHubConnectSessionRequest,
  GitHubConnectSessionResponse,
  GitHubConnectSessionStatusResponse,
  GitHubConnectionStatus,
} from "@codex-builder/shared";

import { config } from "../config.js";
import type { Store } from "../storage/store.js";

type GitHubInstallationResponse = {
  account?: {
    login?: string;
    type?: "Organization" | "User";
  };
  html_url?: string;
  repository_selection?: "selected" | "all";
};

type CallbackResult =
  | {
      type: "connected";
      session: GitHubConnectSession;
      connection: GitHubConnectionStatus;
    }
  | {
      type: "failed";
      title: string;
      message: string;
      session?: GitHubConnectSession;
    };

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function asDate(value: string) {
  return new Date(value).getTime();
}

export class GitHubAppService {
  constructor(private readonly store: Store) {}

  isConfigured() {
    return Boolean(
      config.gitHubAppId?.trim() &&
        config.gitHubAppName?.trim() &&
        config.gitHubAppPrivateKey?.trim(),
    );
  }

  async createConnectSession(request: GitHubConnectSessionRequest): Promise<GitHubConnectSessionResponse> {
    if (!this.isConfigured()) {
      throw new Error("GitHub App is not configured on the backend.");
    }

    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + config.gitHubConnectSessionTtlMs).toISOString();
    const session: GitHubConnectSession = {
      id: randomUUID(),
      tenantId: request.tenantId,
      contentfulContext: request.contentfulContext,
      status: "pending",
      stateNonce: randomUUID(),
      returnUrl: request.returnUrl,
      createdAt,
      updatedAt: createdAt,
      expiresAt,
    };

    await this.store.createGitHubConnectSession(session);

    return {
      sessionId: session.id,
      connectUrl: `${config.gitHubAppBaseUrl}/apps/${config.gitHubAppName}/installations/new?state=${encodeURIComponent(session.stateNonce)}`,
      expiresAt,
    };
  }

  async getConnectSessionStatus(sessionId: string): Promise<GitHubConnectSessionStatusResponse> {
    const session = await this.store.getGitHubConnectSession(sessionId);
    if (!session) {
      throw new Error("GitHub connection session not found.");
    }

    if (session.status === "pending" && asDate(session.expiresAt) <= Date.now()) {
      const expiredSession: GitHubConnectSession = {
        ...session,
        status: "expired",
        updatedAt: nowIso(),
        errorCode: "session_expired",
        errorMessage: "The GitHub connection session expired before completion.",
      };
      await this.store.updateGitHubConnectSession(expiredSession);
      return {
        sessionId,
        status: "expired",
        errorCode: expiredSession.errorCode,
        errorMessage: expiredSession.errorMessage,
      };
    }

    const connection =
      session.status === "connected"
        ? await this.store.getGitHubConnectionByTenant(session.tenantId)
        : null;

    return {
      sessionId,
      status: session.status,
      connection: connection ?? undefined,
      errorCode: session.errorCode,
      errorMessage: session.errorMessage,
    };
  }

  async getConnectionStatus(tenantId: string): Promise<GitHubConnectionStatus> {
    return (await this.store.getGitHubConnectionByTenant(tenantId)) ?? {
      status: "disconnected",
    };
  }

  async disconnect(tenantId: string): Promise<GitHubConnectionStatus> {
    await this.store.clearGitHubConnection(tenantId);
    return {
      status: "disconnected",
    };
  }

  async handleCallback(params: {
    installationId?: string;
    setupAction?: string;
    state?: string;
  }): Promise<CallbackResult> {
    if (!params.state) {
      return {
        type: "failed",
        title: "GitHub connection failed",
        message: "Missing GitHub connection state.",
      };
    }

    const session = await this.store.getGitHubConnectSessionByState(params.state);
    if (!session) {
      return {
        type: "failed",
        title: "GitHub connection failed",
        message: "The GitHub connection session could not be found or has expired.",
      };
    }

    if (asDate(session.expiresAt) <= Date.now()) {
      const expiredSession: GitHubConnectSession = {
        ...session,
        status: "expired",
        updatedAt: nowIso(),
        errorCode: "session_expired",
        errorMessage: "The GitHub connection session expired before completion.",
      };
      await this.store.updateGitHubConnectSession(expiredSession);
      return {
        type: "failed",
        title: "GitHub connection expired",
        message: expiredSession.errorMessage ?? "The GitHub connection session expired before completion.",
        session: expiredSession,
      };
    }

    if (!params.installationId) {
      const failedSession: GitHubConnectSession = {
        ...session,
        status: "failed",
        updatedAt: nowIso(),
        errorCode: "missing_installation_id",
        errorMessage: "GitHub did not return an installation ID.",
      };
      await this.store.updateGitHubConnectSession(failedSession);
      return {
        type: "failed",
        title: "GitHub connection failed",
        message: failedSession.errorMessage ?? "GitHub did not return an installation ID.",
        session: failedSession,
      };
    }

    try {
      const installation = await this.fetchInstallation(params.installationId);
      const connection: GitHubConnectionStatus = {
        status: "connected",
        installationId: params.installationId,
        ownerLogin: installation.account?.login,
        ownerType: installation.account?.type,
        repositorySelection: installation.repository_selection ?? "selected",
        connectedAt: nowIso(),
      };

      const updatedSession: GitHubConnectSession = {
        ...session,
        status: "connected",
        updatedAt: nowIso(),
        installationId: params.installationId,
        ownerLogin: installation.account?.login,
        ownerType: installation.account?.type,
        errorCode: undefined,
        errorMessage: undefined,
      };

      await this.store.upsertGitHubConnection(session.tenantId, connection);
      await this.store.updateGitHubConnectSession(updatedSession);

      return {
        type: "connected",
        session: updatedSession,
        connection,
      };
    } catch (error) {
      const failedSession: GitHubConnectSession = {
        ...session,
        status: "failed",
        updatedAt: nowIso(),
        installationId: params.installationId,
        errorCode: "github_installation_lookup_failed",
        errorMessage: error instanceof Error ? error.message : "GitHub installation lookup failed.",
      };
      await this.store.updateGitHubConnectSession(failedSession);
      return {
        type: "failed",
        title: "GitHub connection failed",
        message: failedSession.errorMessage ?? "GitHub installation lookup failed.",
        session: failedSession,
      };
    }
  }

  private createAppJwt() {
    if (!this.isConfigured()) {
      throw new Error("GitHub App is not configured on the backend.");
    }

    const issuedAt = Math.floor(Date.now() / 1000) - 60;
    const expiresAt = issuedAt + 10 * 60;
    const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = toBase64Url(
      JSON.stringify({
        iat: issuedAt,
        exp: expiresAt,
        iss: config.gitHubAppId,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${payload}`);
    signer.end();
    const signature = signer.sign(config.gitHubAppPrivateKey ?? "");
    return `${header}.${payload}.${toBase64Url(signature)}`;
  }

  private async fetchInstallation(installationId: string): Promise<GitHubInstallationResponse> {
    const token = this.createAppJwt();
    const response = await fetch(`${config.gitHubApiBaseUrl}/app/installations/${installationId}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "codex-contentful-builder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub installation lookup failed with ${response.status}.`);
    }

    return (await response.json()) as GitHubInstallationResponse;
  }
}
