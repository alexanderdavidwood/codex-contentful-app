import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import type {
  GitHubConnectionStatus,
  GitHubUserAuthRecord,
} from "@codex-builder/shared";

import { config } from "../config.js";
import type { Store } from "../storage/store.js";

type GitHubTokenExchangeResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  id: number;
  login: string;
};

type GitHubUserInstallationsResponse = {
  installations?: Array<{
    id: number;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(seconds: number | undefined) {
  if (!seconds) {
    return undefined;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

function normalizeBase64(value: string) {
  return value.replace(/-/g, "+").replace(/_/g, "/");
}

function deriveEncryptionKey() {
  const raw = config.gitHubTokenEncryptionKey?.trim();
  if (!raw) {
    return null;
  }

  const decoded = Buffer.from(normalizeBase64(raw), "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  return null;
}

async function parseJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as GitHubTokenExchangeResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || fallback);
  }
  return payload as T;
}

export class GitHubUserAuthService {
  constructor(private readonly store: Store) {}

  isConfigured() {
    return Boolean(
      config.gitHubAppClientId?.trim() &&
        config.gitHubAppClientSecret?.trim() &&
        deriveEncryptionKey(),
    );
  }

  createPkceVerifier() {
    return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  }

  createPkceChallenge(verifier: string) {
    return createHash("sha256").update(verifier).digest("base64url");
  }

  buildAuthorizationUrl(state: string, redirectUri: string, codeChallenge: string) {
    if (!this.isConfigured()) {
      throw new Error("GitHub user authorization is not configured on the backend.");
    }

    const url = new URL("/login/oauth/authorize", config.gitHubAppBaseUrl);
    url.searchParams.set("client_id", config.gitHubAppClientId ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCodeForUserToken(code: string, redirectUri: string, codeVerifier: string) {
    const tokenUrl = new URL("/login/oauth/access_token", config.gitHubAppBaseUrl);
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.gitHubAppClientId,
        client_secret: config.gitHubAppClientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const payload = await parseJsonResponse<GitHubTokenExchangeResponse>(
      response,
      `GitHub user token exchange failed with ${response.status}.`,
    );

    if (!payload.access_token) {
      throw new Error("GitHub did not return an access token.");
    }

    return {
      accessToken: payload.access_token,
      accessTokenExpiresAt: addSeconds(payload.expires_in),
      refreshToken: payload.refresh_token,
      refreshTokenExpiresAt: addSeconds(payload.refresh_token_expires_in),
    };
  }

  async refreshUserToken(refreshToken: string) {
    const tokenUrl = new URL("/login/oauth/access_token", config.gitHubAppBaseUrl);
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.gitHubAppClientId,
        client_secret: config.gitHubAppClientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const payload = await parseJsonResponse<GitHubTokenExchangeResponse>(
      response,
      `GitHub user token refresh failed with ${response.status}.`,
    );

    if (!payload.access_token) {
      throw new Error("GitHub did not return a refreshed access token.");
    }

    return {
      accessToken: payload.access_token,
      accessTokenExpiresAt: addSeconds(payload.expires_in),
      refreshToken: payload.refresh_token ?? refreshToken,
      refreshTokenExpiresAt: addSeconds(payload.refresh_token_expires_in),
    };
  }

  async getAuthenticatedUser(accessToken: string): Promise<GitHubUserResponse> {
    const response = await fetch(`${config.gitHubApiBaseUrl}/user`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "codex-contentful-builder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub user lookup failed with ${response.status}.`);
    }

    return (await response.json()) as GitHubUserResponse;
  }

  async listUserInstallationIds(accessToken: string): Promise<string[]> {
    const response = await fetch(`${config.gitHubApiBaseUrl}/user/installations`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "codex-contentful-builder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub user installations lookup failed with ${response.status}.`);
    }

    const payload = (await response.json()) as GitHubUserInstallationsResponse;
    return (payload.installations ?? []).map((installation) => `${installation.id}`);
  }

  encryptToken(value: string) {
    const key = deriveEncryptionKey();
    if (!key) {
      throw new Error("GitHub token encryption key is not configured correctly.");
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
  }

  decryptToken(value: string) {
    const key = deriveEncryptionKey();
    if (!key) {
      throw new Error("GitHub token encryption key is not configured correctly.");
    }

    const [ivBase64, tagBase64, ciphertextBase64] = value.split(".");
    if (!ivBase64 || !tagBase64 || !ciphertextBase64) {
      throw new Error("Encrypted GitHub token payload is malformed.");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(normalizeBase64(ivBase64), "base64"),
    );
    decipher.setAuthTag(Buffer.from(normalizeBase64(tagBase64), "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(normalizeBase64(ciphertextBase64), "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }

  async persistUserAuth(args: {
    tenantId: string;
    installationId: string;
    githubUserId: string;
    githubUserLogin: string;
    accessToken: string;
    accessTokenExpiresAt?: string;
    refreshToken?: string;
    refreshTokenExpiresAt?: string;
  }): Promise<GitHubUserAuthRecord> {
    const createdAt = nowIso();
    const current = await this.store.getGitHubUserAuthByTenant(args.tenantId);
    const record: GitHubUserAuthRecord = {
      tenantId: args.tenantId,
      githubUserId: args.githubUserId,
      githubUserLogin: args.githubUserLogin,
      installationId: args.installationId,
      accessTokenEncrypted: this.encryptToken(args.accessToken),
      refreshTokenEncrypted: args.refreshToken
        ? this.encryptToken(args.refreshToken)
        : current?.refreshTokenEncrypted,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      refreshTokenExpiresAt: args.refreshTokenExpiresAt ?? current?.refreshTokenExpiresAt,
      createdAt: current?.createdAt ?? createdAt,
      updatedAt: createdAt,
    };

    await this.store.upsertGitHubUserAuth(record);
    return record;
  }

  async getValidUserToken(tenantId: string) {
    const record = await this.store.getGitHubUserAuthByTenant(tenantId);
    if (!record) {
      throw new Error("GitHub user authorization is missing for this tenant.");
    }

    const expiresAt = record.accessTokenExpiresAt
      ? new Date(record.accessTokenExpiresAt).getTime()
      : null;
    const isExpired = expiresAt !== null && expiresAt <= Date.now() + 60_000;

    if (!isExpired) {
      return this.decryptToken(record.accessTokenEncrypted);
    }

    if (!record.refreshTokenEncrypted) {
      throw new Error("GitHub user access token expired and no refresh token is stored.");
    }

    const refreshToken = this.decryptToken(record.refreshTokenEncrypted);
    const refreshed = await this.refreshUserToken(refreshToken);
    await this.persistUserAuth({
      tenantId: record.tenantId,
      installationId: record.installationId,
      githubUserId: record.githubUserId,
      githubUserLogin: record.githubUserLogin,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
      refreshToken: refreshed.refreshToken,
      refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt,
    });

    return refreshed.accessToken;
  }

  mergeConnectionWithUserAuth(
    connection: GitHubConnectionStatus | null,
    userAuth: GitHubUserAuthRecord | null,
  ): GitHubConnectionStatus {
    if (!connection) {
      return {
        status: "disconnected",
        userAuthorizationStatus: userAuth ? "authorized" : "missing",
      };
    }

    if (!userAuth) {
      return {
        ...connection,
        githubUserId: connection.githubUserId,
        githubUserLogin: connection.githubUserLogin,
        userAuthorizationStatus: connection.status === "connected" ? "missing" : connection.userAuthorizationStatus,
      };
    }

    const tokenExpiry = userAuth.accessTokenExpiresAt
      ? new Date(userAuth.accessTokenExpiresAt).getTime()
      : null;
    const userAuthorizationStatus =
      tokenExpiry !== null && tokenExpiry <= Date.now() && !userAuth.refreshTokenEncrypted
        ? "expired"
        : "authorized";

    return {
      ...connection,
      githubUserId: userAuth.githubUserId,
      githubUserLogin: userAuth.githubUserLogin,
      userAuthorizationStatus,
      tokenExpiresAt: userAuth.accessTokenExpiresAt,
    };
  }
}
