import { spawn } from "node:child_process";

import type {
  GitHubConnectionStatus,
  GitHubRepository,
  ProjectRecord,
} from "@codex-builder/shared";

import { config } from "../config.js";
import { createRedactor } from "../utils/redaction.js";
import { GitHubAppAuthService } from "./githubAppAuthService.js";
import { GitHubUserAuthService } from "./githubUserAuthService.js";

type GitHubCreateRepositoryResponse = {
  html_url?: string;
  name?: string;
  owner?: {
    login?: string;
  };
  private?: boolean;
  visibility?: "private" | "public" | "internal";
};

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function randomSuffix() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function toBasicAuthToken(token: string) {
  return Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
}

async function parseJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new Error(payload.message || fallback);
  }
  return payload as T;
}

type GitHubRepositoryTokenMode = "installation" | "user";

export class GitHubRepositoryService {
  private readonly redact = createRedactor(config.secretRedactionValues);

  constructor(
    private readonly appAuthService: GitHubAppAuthService,
    private readonly userAuthService: GitHubUserAuthService,
  ) {}

  buildRepositoryName(projectName: string) {
    const base = slugify(projectName) || "managed-app";
    const prefix = "codex-builder-";
    const maxBaseLength = 63 - prefix.length - 1 - 6;
    const truncatedBase = base.slice(0, Math.max(maxBaseLength, 8)).replace(/-+$/g, "");
    return `${prefix}${truncatedBase}-${randomSuffix()}`;
  }

  buildRemoteUrl(owner: string, repoName: string) {
    return `${stripTrailingSlash(config.gitHubAppBaseUrl)}/${owner}/${repoName}.git`;
  }

  async createRepository(
    tenantId: string,
    connection: GitHubConnectionStatus,
    repoName: string,
    description: string,
    visibility: GitHubRepository["visibility"] = "private",
  ): Promise<GitHubRepository> {
    if (!connection.installationId || !connection.ownerLogin || !connection.ownerType) {
      throw new Error("GitHub connection is missing installation or owner metadata.");
    }

    const tokenMode = this.getTokenMode(connection);
    const token = await this.getToken(tenantId, connection, tokenMode);

    const endpoint =
      connection.ownerType === "Organization"
        ? `${config.gitHubApiBaseUrl}/orgs/${connection.ownerLogin}/repos`
        : `${config.gitHubApiBaseUrl}/user/repos`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "codex-contentful-builder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        name: repoName,
        description,
        private: visibility === "private",
        visibility,
        auto_init: false,
      }),
    });

    const payload = await parseJsonResponse<GitHubCreateRepositoryResponse>(
      response,
      `GitHub repository creation failed with ${response.status}.`,
    );

    return {
      provider: "github",
      owner: payload.owner?.login ?? connection.ownerLogin,
      name: payload.name ?? repoName,
      defaultBranch: "main",
      visibility: payload.visibility ?? (payload.private ? "private" : visibility),
      htmlUrl:
        payload.html_url ??
        `${stripTrailingSlash(config.gitHubAppBaseUrl)}/${connection.ownerLogin}/${repoName}`,
    };
  }

  async deleteRepository(
    tenantId: string,
    connection: GitHubConnectionStatus,
    owner: string,
    repoName: string,
  ): Promise<void> {
    const token = await this.getToken(tenantId, connection, this.getTokenMode(connection));
    const response = await fetch(`${config.gitHubApiBaseUrl}/repos/${owner}/${repoName}`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "codex-contentful-builder",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok && response.status !== 404) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message || `GitHub repository rollback failed with ${response.status}.`);
    }
  }

  async pushWorkspace(tenantId: string, project: ProjectRecord, connection: GitHubConnectionStatus): Promise<void> {
    if (!project.repository) {
      throw new Error("Project repository metadata is missing.");
    }

    const token = await this.getToken(tenantId, connection, this.getTokenMode(connection));
    const remoteUrl = this.buildRemoteUrl(project.repository.owner, project.repository.name);
    await this.runGit(["remote", "remove", "origin"], project.workspacePath, token).catch(() => undefined);
    await this.runGit(["remote", "add", "origin", remoteUrl], project.workspacePath, token, true);
    await this.runGit(["push", "--set-upstream", "origin", project.repository.defaultBranch], project.workspacePath, token, true);
  }

  private getTokenMode(connection: GitHubConnectionStatus): GitHubRepositoryTokenMode {
    if (connection.ownerType === "Organization") {
      return "installation";
    }

    return "user";
  }

  private async getToken(
    tenantId: string,
    connection: GitHubConnectionStatus,
    mode: GitHubRepositoryTokenMode,
  ) {
    if (mode === "installation") {
      if (!connection.installationId) {
        throw new Error("GitHub installation ID is missing.");
      }

      const tokenResponse = await this.appAuthService.getInstallationAccessToken(connection.installationId);
      return tokenResponse.token;
    }

    return this.userAuthService.getValidUserToken(tenantId);
  }

  private runGit(
    args: string[],
    cwd: string,
    token: string,
    allowFailure = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const authHeader = `AUTHORIZATION: basic ${toBasicAuthToken(token)}`;
      const child = spawn(
        "git",
        ["-c", `http.extraheader=${authHeader}`, ...args],
        {
          cwd,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        if (allowFailure) {
          reject(error);
          return;
        }
        reject(error);
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        const message = this.redact(stderr.trim()) || `git ${args.join(" ")} failed with code ${code ?? "unknown"}.`;
        reject(new Error(message));
      });
    });
  }
}
