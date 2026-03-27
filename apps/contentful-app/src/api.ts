import type {
  BuilderBootstrapResponse,
  BuilderConfigStatusResponse,
  BuilderContentfulContext,
  BuilderCreateProjectRequest,
  BuilderCreateRunResponse,
  BuilderGitHubConnectSessionResponse,
  BuilderGitHubConnectSessionStatusResponse,
  BuilderGitHubConnectionStatus,
  BuilderInstallationParameters,
  BuilderProjectDetail,
} from "./types.js";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function bootstrapBuilder(installation: BuilderInstallationParameters): Promise<BuilderBootstrapResponse> {
  return requestJson(`${installation.apiBaseUrl}/v1/installations/bootstrap`, {
    method: "POST",
    body: JSON.stringify({ installation }),
  });
}

export function getConfigStatus(
  installation: BuilderInstallationParameters,
): Promise<BuilderConfigStatusResponse> {
  return requestJson(`${installation.apiBaseUrl}/v1/config/status`, {
    method: "POST",
    body: JSON.stringify({ installation }),
  });
}

export function startGitHubConnectSession(
  installation: BuilderInstallationParameters,
  contentfulContext: BuilderContentfulContext,
  returnUrl: string,
): Promise<BuilderGitHubConnectSessionResponse> {
  return requestJson(`${installation.apiBaseUrl}/v1/config/github/connect-session`, {
    method: "POST",
    body: JSON.stringify({
      tenantId: installation.tenantId,
      apiBaseUrl: installation.apiBaseUrl,
      contentfulContext,
      returnUrl,
    }),
  });
}

export function getGitHubConnectSessionStatus(
  installation: Pick<BuilderInstallationParameters, "apiBaseUrl">,
  sessionId: string,
): Promise<BuilderGitHubConnectSessionStatusResponse> {
  return requestJson(`${installation.apiBaseUrl}/v1/config/github/connect-session/${sessionId}`);
}

export function getGitHubConnectionStatus(
  installation: Pick<BuilderInstallationParameters, "apiBaseUrl" | "tenantId">,
): Promise<BuilderGitHubConnectionStatus> {
  const query = new URLSearchParams({ tenantId: installation.tenantId });
  return requestJson(`${installation.apiBaseUrl}/v1/config/github/status?${query.toString()}`);
}

export function disconnectGitHub(
  installation: Pick<BuilderInstallationParameters, "apiBaseUrl" | "tenantId">,
): Promise<BuilderGitHubConnectionStatus> {
  return requestJson(`${installation.apiBaseUrl}/v1/config/github/disconnect`, {
    method: "POST",
    body: JSON.stringify({ tenantId: installation.tenantId }),
  });
}

export function createProject(
  installation: BuilderInstallationParameters,
  project: BuilderCreateProjectRequest,
) {
  return requestJson(`${installation.apiBaseUrl}/v1/projects`, {
    method: "POST",
    body: JSON.stringify(project),
  });
}

export function getProjectDetail(
  installation: BuilderInstallationParameters,
  projectId: string,
): Promise<BuilderProjectDetail> {
  return requestJson(`${installation.apiBaseUrl}/v1/projects/${projectId}`);
}

export function startRun(
  installation: BuilderInstallationParameters,
  projectId: string,
  prompt: string,
): Promise<BuilderCreateRunResponse> {
  return requestJson(`${installation.apiBaseUrl}/v1/projects/${projectId}/runs`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export function subscribeToRun(
  installation: BuilderInstallationParameters,
  runId: string,
  onMessage: (payload: unknown) => void,
): () => void {
  const source = new EventSource(`${installation.apiBaseUrl}/v1/runs/${runId}/stream`);
  source.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };
  source.onerror = () => {
    source.close();
  };

  return () => source.close();
}
