import type {
  GitHubConnectSession,
  GitHubConnectionStatus,
  ProjectRecord,
  RunRecord,
  TenantInstallationConfig,
} from "@codex-builder/shared";

import type { Store } from "./store.js";

export class MemoryStore implements Store {
  private readonly installations = new Map<string, TenantInstallationConfig>();
  private readonly gitHubConnections = new Map<string, GitHubConnectionStatus>();
  private readonly gitHubConnectSessions = new Map<string, GitHubConnectSession>();
  private readonly projects = new Map<string, { tenantId: string; project: ProjectRecord }>();
  private readonly runs = new Map<string, RunRecord>();

  async init(): Promise<void> {}

  async upsertInstallation(config: TenantInstallationConfig): Promise<void> {
    this.installations.set(config.tenantId, config);
  }

  async getInstallation(tenantId: string): Promise<TenantInstallationConfig | null> {
    return this.installations.get(tenantId) ?? null;
  }

  async listProjects(tenantId: string): Promise<ProjectRecord[]> {
    return Array.from(this.projects.values())
      .filter((entry) => entry.tenantId === tenantId)
      .map((entry) => entry.project)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createProject(tenantId: string, project: ProjectRecord): Promise<void> {
    this.projects.set(project.id, { tenantId, project });
  }

  async getProject(projectId: string): Promise<ProjectRecord | null> {
    return this.projects.get(projectId)?.project ?? null;
  }

  async createRun(run: RunRecord): Promise<void> {
    this.runs.set(run.id, run);
  }

  async updateRun(run: RunRecord): Promise<void> {
    this.runs.set(run.id, run);
  }

  async listRuns(projectId: string): Promise<RunRecord[]> {
    return Array.from(this.runs.values())
      .filter((run) => run.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    return this.runs.get(runId) ?? null;
  }

  async createGitHubConnectSession(session: GitHubConnectSession): Promise<void> {
    this.gitHubConnectSessions.set(session.id, session);
  }

  async getGitHubConnectSession(sessionId: string): Promise<GitHubConnectSession | null> {
    return this.gitHubConnectSessions.get(sessionId) ?? null;
  }

  async getGitHubConnectSessionByState(stateNonce: string): Promise<GitHubConnectSession | null> {
    return Array.from(this.gitHubConnectSessions.values()).find((session) => session.stateNonce === stateNonce) ?? null;
  }

  async updateGitHubConnectSession(session: GitHubConnectSession): Promise<void> {
    this.gitHubConnectSessions.set(session.id, session);
  }

  async getGitHubConnectionByTenant(tenantId: string): Promise<GitHubConnectionStatus | null> {
    return this.gitHubConnections.get(tenantId) ?? null;
  }

  async upsertGitHubConnection(tenantId: string, connection: GitHubConnectionStatus): Promise<void> {
    this.gitHubConnections.set(tenantId, connection);
  }

  async clearGitHubConnection(tenantId: string): Promise<void> {
    this.gitHubConnections.delete(tenantId);
  }
}
