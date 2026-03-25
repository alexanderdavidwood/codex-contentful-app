import type {
  ProjectRecord,
  RunRecord,
  TenantInstallationConfig,
} from "@codex-builder/shared";

import type { Store } from "./store.js";

export class MemoryStore implements Store {
  private readonly installations = new Map<string, TenantInstallationConfig>();
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
}
