import type {
  GitHubConnectSession,
  GitHubConnectionStatus,
  GitHubUserAuthRecord,
  ProjectRecord,
  RunRecord,
  TenantInstallationConfig,
} from "@codex-builder/shared";

export interface Store {
  init(): Promise<void>;
  upsertInstallation(config: TenantInstallationConfig): Promise<void>;
  getInstallation(tenantId: string): Promise<TenantInstallationConfig | null>;
  listProjects(tenantId: string): Promise<ProjectRecord[]>;
  createProject(tenantId: string, project: ProjectRecord): Promise<void>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  createRun(run: RunRecord): Promise<void>;
  updateRun(run: RunRecord): Promise<void>;
  listRuns(projectId: string): Promise<RunRecord[]>;
  getRun(runId: string): Promise<RunRecord | null>;
  createGitHubConnectSession(session: GitHubConnectSession): Promise<void>;
  getGitHubConnectSession(sessionId: string): Promise<GitHubConnectSession | null>;
  getGitHubConnectSessionByInstallState(installState: string): Promise<GitHubConnectSession | null>;
  getGitHubConnectSessionByOauthState(oauthState: string): Promise<GitHubConnectSession | null>;
  updateGitHubConnectSession(session: GitHubConnectSession): Promise<void>;
  getGitHubConnectionByTenant(tenantId: string): Promise<GitHubConnectionStatus | null>;
  upsertGitHubConnection(tenantId: string, connection: GitHubConnectionStatus): Promise<void>;
  clearGitHubConnection(tenantId: string): Promise<void>;
  getGitHubUserAuthByTenant(tenantId: string): Promise<GitHubUserAuthRecord | null>;
  upsertGitHubUserAuth(record: GitHubUserAuthRecord): Promise<void>;
  clearGitHubUserAuth(tenantId: string): Promise<void>;
}
