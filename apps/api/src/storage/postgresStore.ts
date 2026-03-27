import type {
  GitHubConnectSession,
  GitHubConnectionStatus,
  ProjectRecord,
  RunRecord,
  TenantInstallationConfig,
} from "@codex-builder/shared";
import { Pool } from "pg";

import type { Store } from "./store.js";

export class PostgresStore implements Store {
  constructor(private readonly pool: Pool) {}

  async init(): Promise<void> {
    await this.pool.query(`
      create table if not exists installations (
        tenant_id text primary key,
        payload jsonb not null
      );

      create table if not exists projects (
        id text primary key,
        tenant_id text not null,
        payload jsonb not null
      );

      create table if not exists runs (
        id text primary key,
        project_id text not null,
        payload jsonb not null
      );

      create table if not exists github_connect_sessions (
        id text primary key,
        state_nonce text not null unique,
        tenant_id text not null,
        payload jsonb not null
      );

      create table if not exists github_connections (
        tenant_id text primary key,
        payload jsonb not null
      );
    `);
  }

  async upsertInstallation(config: TenantInstallationConfig): Promise<void> {
    await this.pool.query(
      `
        insert into installations (tenant_id, payload)
        values ($1, $2::jsonb)
        on conflict (tenant_id) do update set payload = excluded.payload
      `,
      [config.tenantId, JSON.stringify(config)],
    );
  }

  async getInstallation(tenantId: string): Promise<TenantInstallationConfig | null> {
    const result = await this.pool.query<{ payload: TenantInstallationConfig }>(
      "select payload from installations where tenant_id = $1",
      [tenantId],
    );
    return (result.rows[0]?.payload as TenantInstallationConfig | undefined) ?? null;
  }

  async listProjects(tenantId: string): Promise<ProjectRecord[]> {
    const result = await this.pool.query<{ payload: ProjectRecord }>(
      "select payload from projects where tenant_id = $1 order by payload->>'createdAt' desc",
      [tenantId],
    );
    return result.rows.map((row) => row.payload as ProjectRecord);
  }

  async createProject(tenantId: string, project: ProjectRecord): Promise<void> {
    await this.pool.query(
      "insert into projects (id, tenant_id, payload) values ($1, $2, $3::jsonb)",
      [project.id, tenantId, JSON.stringify(project)],
    );
  }

  async getProject(projectId: string): Promise<ProjectRecord | null> {
    const result = await this.pool.query<{ payload: ProjectRecord }>(
      "select payload from projects where id = $1",
      [projectId],
    );
    return (result.rows[0]?.payload as ProjectRecord | undefined) ?? null;
  }

  async createRun(run: RunRecord): Promise<void> {
    await this.pool.query(
      "insert into runs (id, project_id, payload) values ($1, $2, $3::jsonb)",
      [run.id, run.projectId, JSON.stringify(run)],
    );
  }

  async updateRun(run: RunRecord): Promise<void> {
    await this.pool.query("update runs set payload = $2::jsonb where id = $1", [run.id, JSON.stringify(run)]);
  }

  async listRuns(projectId: string): Promise<RunRecord[]> {
    const result = await this.pool.query<{ payload: RunRecord }>(
      "select payload from runs where project_id = $1 order by payload->>'createdAt' desc",
      [projectId],
    );
    return result.rows.map((row) => row.payload as RunRecord);
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const result = await this.pool.query<{ payload: RunRecord }>(
      "select payload from runs where id = $1",
      [runId],
    );
    return (result.rows[0]?.payload as RunRecord | undefined) ?? null;
  }

  async createGitHubConnectSession(session: GitHubConnectSession): Promise<void> {
    await this.pool.query(
      `
        insert into github_connect_sessions (id, state_nonce, tenant_id, payload)
        values ($1, $2, $3, $4::jsonb)
      `,
      [session.id, session.stateNonce, session.tenantId, JSON.stringify(session)],
    );
  }

  async getGitHubConnectSession(sessionId: string): Promise<GitHubConnectSession | null> {
    const result = await this.pool.query<{ payload: GitHubConnectSession }>(
      "select payload from github_connect_sessions where id = $1",
      [sessionId],
    );
    return (result.rows[0]?.payload as GitHubConnectSession | undefined) ?? null;
  }

  async getGitHubConnectSessionByState(stateNonce: string): Promise<GitHubConnectSession | null> {
    const result = await this.pool.query<{ payload: GitHubConnectSession }>(
      "select payload from github_connect_sessions where state_nonce = $1",
      [stateNonce],
    );
    return (result.rows[0]?.payload as GitHubConnectSession | undefined) ?? null;
  }

  async updateGitHubConnectSession(session: GitHubConnectSession): Promise<void> {
    await this.pool.query(
      "update github_connect_sessions set state_nonce = $2, tenant_id = $3, payload = $4::jsonb where id = $1",
      [session.id, session.stateNonce, session.tenantId, JSON.stringify(session)],
    );
  }

  async getGitHubConnectionByTenant(tenantId: string): Promise<GitHubConnectionStatus | null> {
    const result = await this.pool.query<{ payload: GitHubConnectionStatus }>(
      "select payload from github_connections where tenant_id = $1",
      [tenantId],
    );
    return (result.rows[0]?.payload as GitHubConnectionStatus | undefined) ?? null;
  }

  async upsertGitHubConnection(tenantId: string, connection: GitHubConnectionStatus): Promise<void> {
    await this.pool.query(
      `
        insert into github_connections (tenant_id, payload)
        values ($1, $2::jsonb)
        on conflict (tenant_id) do update set payload = excluded.payload
      `,
      [tenantId, JSON.stringify(connection)],
    );
  }

  async clearGitHubConnection(tenantId: string): Promise<void> {
    await this.pool.query("delete from github_connections where tenant_id = $1", [tenantId]);
  }
}
