import type {
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
}
