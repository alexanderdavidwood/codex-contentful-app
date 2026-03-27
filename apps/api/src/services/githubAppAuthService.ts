import { createSign } from "node:crypto";

import { config } from "../config.js";

export type GitHubInstallationResponse = {
  id: number;
  account?: {
    login?: string;
    type?: "Organization" | "User";
  };
  html_url?: string;
  repository_selection?: "selected" | "all";
};

type GitHubInstallationTokenResponse = {
  token: string;
  expires_at?: string;
};

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function parseJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let message = fallback;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Fall back to the provided message if GitHub does not return JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export class GitHubAppAuthService {
  isConfigured() {
    return Boolean(
      config.gitHubAppId?.trim() &&
        config.gitHubAppName?.trim() &&
        config.gitHubAppPrivateKey?.trim(),
    );
  }

  createAppJwt() {
    if (!this.isConfigured()) {
      throw new Error("GitHub App authentication is not configured on the backend.");
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

  async getInstallation(installationId: string): Promise<GitHubInstallationResponse> {
    const token = this.createAppJwt();
    const response = await fetch(`${config.gitHubApiBaseUrl}/app/installations/${installationId}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "codex-contentful-builder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return parseJsonResponse<GitHubInstallationResponse>(
      response,
      `GitHub installation lookup failed with ${response.status}.`,
    );
  }

  async getInstallationAccessToken(installationId: string): Promise<GitHubInstallationTokenResponse> {
    const token = this.createAppJwt();
    const response = await fetch(`${config.gitHubApiBaseUrl}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "codex-contentful-builder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({}),
    });

    return parseJsonResponse<GitHubInstallationTokenResponse>(
      response,
      `GitHub installation token request failed with ${response.status}.`,
    );
  }
}
