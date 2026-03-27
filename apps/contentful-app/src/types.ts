import type {
  BootstrapResponse,
  ConfigStatusResponse,
  ContentfulContext,
  CreateProjectRequest,
  CreateRunResponse,
  GitHubConnectSessionResponse,
  GitHubConnectSessionStatusResponse,
  GitHubConnectionStatus,
  ProjectDetailResponse,
  ProjectRecord,
  TenantInstallationConfig,
} from "@codex-builder/shared";

export type BuilderInstallationParameters = TenantInstallationConfig;

export type BuilderBootstrapResponse = BootstrapResponse;
export type BuilderConfigStatusResponse = ConfigStatusResponse;
export type BuilderContentfulContext = ContentfulContext;
export type BuilderGitHubConnectSessionResponse = GitHubConnectSessionResponse;
export type BuilderGitHubConnectSessionStatusResponse = GitHubConnectSessionStatusResponse;
export type BuilderGitHubConnectionStatus = GitHubConnectionStatus;
export type BuilderProject = ProjectRecord;
export type BuilderProjectDetail = ProjectDetailResponse;
export type BuilderCreateProjectRequest = CreateProjectRequest;
export type BuilderCreateRunResponse = CreateRunResponse;
