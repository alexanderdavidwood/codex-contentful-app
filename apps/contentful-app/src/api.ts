import type {
  BuilderBootstrapResponse,
  BuilderCreateProjectRequest,
  BuilderCreateRunResponse,
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
