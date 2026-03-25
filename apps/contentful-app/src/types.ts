import type {
  BootstrapResponse,
  CreateProjectRequest,
  CreateRunResponse,
  ProjectDetailResponse,
  ProjectRecord,
  TenantInstallationConfig,
} from "@codex-builder/shared";

export type BuilderInstallationParameters = TenantInstallationConfig;

export type BuilderBootstrapResponse = BootstrapResponse;
export type BuilderProject = ProjectRecord;
export type BuilderProjectDetail = ProjectDetailResponse;
export type BuilderCreateProjectRequest = CreateProjectRequest;
export type BuilderCreateRunResponse = CreateRunResponse;
