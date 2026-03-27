import { randomUUID } from "node:crypto";

import type {
  GitHubConnectSession,
  GitHubConnectSessionRequest,
  GitHubConnectSessionResponse,
  GitHubConnectSessionStatusResponse,
  GitHubConnectionStatus,
} from "@codex-builder/shared";

import { config } from "../config.js";
import type { Store } from "../storage/store.js";
import { GitHubAppAuthService } from "./githubAppAuthService.js";
import { GitHubUserAuthService } from "./githubUserAuthService.js";

type SetupRedirectResult =
  | {
      type: "redirect";
      redirectUrl: string;
      session: GitHubConnectSession;
    }
  | {
      type: "failed";
      title: string;
      message: string;
      session?: GitHubConnectSession;
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

function nowIso() {
  return new Date().toISOString();
}

function asDate(value: string) {
  return new Date(value).getTime();
}

function getAuthMode(ownerType: "Organization" | "User" | undefined) {
  return ownerType === "Organization" ? "installation" : "user";
}

export class GitHubAppService {
  constructor(
    private readonly store: Store,
    private readonly appAuthService: GitHubAppAuthService,
    private readonly userAuthService: GitHubUserAuthService,
  ) {}

  isConfigured() {
    return this.appAuthService.isConfigured();
  }

  isUserAuthConfigured() {
    return this.userAuthService.isConfigured();
  }

  async createConnectSession(request: GitHubConnectSessionRequest): Promise<GitHubConnectSessionResponse> {
    if (!this.isConfigured()) {
      throw new Error("GitHub App is not configured on the backend.");
    }

    if (!this.isUserAuthConfigured()) {
      throw new Error("GitHub user authorization is not configured on the backend.");
    }

    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + config.gitHubConnectSessionTtlMs).toISOString();
    const pkceVerifier = this.userAuthService.createPkceVerifier();
    const session: GitHubConnectSession = {
      id: randomUUID(),
      tenantId: request.tenantId,
      contentfulContext: request.contentfulContext,
      status: "pending",
      authorizationStatus: "awaiting_installation",
      installState: randomUUID(),
      oauthState: randomUUID(),
      pkceVerifier,
      returnUrl: request.returnUrl,
      createdAt,
      updatedAt: createdAt,
      expiresAt,
    };

    await this.store.createGitHubConnectSession(session);

    return {
      sessionId: session.id,
      connectUrl: `${config.gitHubAppBaseUrl}/apps/${config.gitHubAppName}/installations/new?state=${encodeURIComponent(session.installState)}`,
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
        authorizationStatus: "error",
        updatedAt: nowIso(),
        errorCode: "session_expired",
        errorMessage: "The GitHub connection session expired before completion.",
      };
      await this.store.updateGitHubConnectSession(expiredSession);
      return {
        sessionId,
        status: "expired",
        authorizationStatus: expiredSession.authorizationStatus,
        errorCode: expiredSession.errorCode,
        errorMessage: expiredSession.errorMessage,
      };
    }

    const connection =
      session.status === "connected"
        ? await this.getConnectionStatus(session.tenantId)
        : undefined;

    return {
      sessionId,
      status: session.status,
      authorizationStatus: session.authorizationStatus,
      connection,
      errorCode: session.errorCode,
      errorMessage: session.errorMessage,
    };
  }

  async getConnectionStatus(tenantId: string): Promise<GitHubConnectionStatus> {
    const connection = await this.store.getGitHubConnectionByTenant(tenantId);
    const userAuth = await this.store.getGitHubUserAuthByTenant(tenantId);
    const merged = this.userAuthService.mergeConnectionWithUserAuth(connection, userAuth);

    if (!merged.authMode && merged.ownerType) {
      return {
        ...merged,
        authMode: getAuthMode(merged.ownerType),
      };
    }

    return merged;
  }

  async disconnect(tenantId: string): Promise<GitHubConnectionStatus> {
    await this.store.clearGitHubConnection(tenantId);
    await this.store.clearGitHubUserAuth(tenantId);
    return {
      status: "disconnected",
      userAuthorizationStatus: "missing",
    };
  }

  async handleSetupRedirect(params: {
    installationId?: string;
    setupAction?: string;
    state?: string;
  }): Promise<SetupRedirectResult> {
    if (!params.state) {
      return {
        type: "failed",
        title: "GitHub connection failed",
        message: "Missing GitHub installation state.",
      };
    }

    const session = await this.store.getGitHubConnectSessionByInstallState(params.state);
    if (!session) {
      return {
        type: "failed",
        title: "GitHub connection failed",
        message: "The GitHub installation session could not be found or has expired.",
      };
    }

    if (asDate(session.expiresAt) <= Date.now()) {
      const expiredSession: GitHubConnectSession = {
        ...session,
        status: "expired",
        authorizationStatus: "error",
        updatedAt: nowIso(),
        errorCode: "session_expired",
        errorMessage: "The GitHub connection session expired before installation completed.",
      };
      await this.store.updateGitHubConnectSession(expiredSession);
      return {
        type: "failed",
        title: "GitHub connection expired",
        message: expiredSession.errorMessage ?? "The GitHub connection session expired before installation completed.",
        session: expiredSession,
      };
    }

    if (!params.installationId) {
      const failedSession: GitHubConnectSession = {
        ...session,
        status: "failed",
        authorizationStatus: "error",
        updatedAt: nowIso(),
        errorCode: "missing_installation_id",
        errorMessage: "GitHub did not return an installation ID from the setup redirect.",
      };
      await this.store.updateGitHubConnectSession(failedSession);
      return {
        type: "failed",
        title: "GitHub connection failed",
        message: failedSession.errorMessage ?? "GitHub did not return an installation ID from the setup redirect.",
        session: failedSession,
      };
    }

    const updatedSession: GitHubConnectSession = {
      ...session,
      updatedAt: nowIso(),
      pendingInstallationId: params.installationId,
      authorizationStatus: "awaiting_authorization",
      errorCode: undefined,
      errorMessage: undefined,
    };
    await this.store.updateGitHubConnectSession(updatedSession);

    const redirectUrl = this.userAuthService.buildAuthorizationUrl(
      updatedSession.oauthState,
      `${config.defaultApiBaseUrl}/v1/oauth/github/callback`,
      this.userAuthService.createPkceChallenge(updatedSession.pkceVerifier),
    );

    return {
      type: "redirect",
      redirectUrl,
      session: updatedSession,
    };
  }

  async handleOAuthCallback(params: {
    code?: string;
    state?: string;
  }): Promise<CallbackResult> {
    if (!params.state) {
      return {
        type: "failed",
        title: "GitHub authorization failed",
        message: "Missing GitHub authorization state.",
      };
    }

    const session = await this.store.getGitHubConnectSessionByOauthState(params.state);
    if (!session) {
      return {
        type: "failed",
        title: "GitHub authorization failed",
        message: "The GitHub authorization session could not be found or has expired.",
      };
    }

    if (asDate(session.expiresAt) <= Date.now()) {
      const expiredSession: GitHubConnectSession = {
        ...session,
        status: "expired",
        authorizationStatus: "error",
        updatedAt: nowIso(),
        errorCode: "session_expired",
        errorMessage: "The GitHub connection session expired before authorization completed.",
      };
      await this.store.updateGitHubConnectSession(expiredSession);
      return {
        type: "failed",
        title: "GitHub connection expired",
        message: expiredSession.errorMessage ?? "The GitHub connection session expired before authorization completed.",
        session: expiredSession,
      };
    }

    if (!params.code) {
      const failedSession: GitHubConnectSession = {
        ...session,
        status: "failed",
        authorizationStatus: "error",
        updatedAt: nowIso(),
        errorCode: "missing_oauth_code",
        errorMessage: "GitHub did not return an authorization code.",
      };
      await this.store.updateGitHubConnectSession(failedSession);
      return {
        type: "failed",
        title: "GitHub authorization failed",
        message: failedSession.errorMessage ?? "GitHub did not return an authorization code.",
        session: failedSession,
      };
    }

    if (!session.pendingInstallationId) {
      const failedSession: GitHubConnectSession = {
        ...session,
        status: "failed",
        authorizationStatus: "error",
        updatedAt: nowIso(),
        errorCode: "missing_pending_installation",
        errorMessage: "GitHub installation details are missing from the setup flow.",
      };
      await this.store.updateGitHubConnectSession(failedSession);
      return {
        type: "failed",
        title: "GitHub authorization failed",
        message: failedSession.errorMessage ?? "GitHub installation details are missing from the setup flow.",
        session: failedSession,
      };
    }

    try {
      const tokenResponse = await this.userAuthService.exchangeCodeForUserToken(
        params.code,
        `${config.defaultApiBaseUrl}/v1/oauth/github/callback`,
        session.pkceVerifier,
      );
      const githubUser = await this.userAuthService.getAuthenticatedUser(tokenResponse.accessToken);
      const installationIds = await this.userAuthService.listUserInstallationIds(tokenResponse.accessToken);

      if (!installationIds.includes(session.pendingInstallationId)) {
        throw new Error("The authorized GitHub user does not have access to the installed GitHub App.");
      }

      const installation = await this.appAuthService.getInstallation(session.pendingInstallationId);
      await this.userAuthService.persistUserAuth({
        tenantId: session.tenantId,
        installationId: session.pendingInstallationId,
        githubUserId: `${githubUser.id}`,
        githubUserLogin: githubUser.login,
        accessToken: tokenResponse.accessToken,
        accessTokenExpiresAt: tokenResponse.accessTokenExpiresAt,
        refreshToken: tokenResponse.refreshToken,
        refreshTokenExpiresAt: tokenResponse.refreshTokenExpiresAt,
      });

      const connection: GitHubConnectionStatus = {
        status: "connected",
        installationId: session.pendingInstallationId,
        installationUrl: installation.html_url,
        ownerLogin: installation.account?.login,
        ownerType: installation.account?.type,
        repositorySelection: installation.repository_selection ?? "selected",
        connectedAt: nowIso(),
        authMode: getAuthMode(installation.account?.type),
        githubUserId: `${githubUser.id}`,
        githubUserLogin: githubUser.login,
        userAuthorizationStatus: "authorized",
        tokenExpiresAt: tokenResponse.accessTokenExpiresAt,
      };

      const updatedSession: GitHubConnectSession = {
        ...session,
        status: "connected",
        authorizationStatus: "authorized",
        updatedAt: nowIso(),
        installationId: session.pendingInstallationId,
        ownerLogin: installation.account?.login,
        ownerType: installation.account?.type,
        githubUserId: `${githubUser.id}`,
        githubUserLogin: githubUser.login,
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
        authorizationStatus: "error",
        updatedAt: nowIso(),
        errorCode: "github_authorization_failed",
        errorMessage: error instanceof Error ? error.message : "GitHub authorization failed.",
      };
      await this.store.updateGitHubConnectSession(failedSession);
      return {
        type: "failed",
        title: "GitHub authorization failed",
        message: failedSession.errorMessage ?? "GitHub authorization failed.",
        session: failedSession,
      };
    }
  }
}
