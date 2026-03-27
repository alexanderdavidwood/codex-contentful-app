import type { BuilderInstallationParameters } from "./types.js";

const DEFAULT_API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8787";

export const DEFAULT_INSTALLATION_PARAMETERS: BuilderInstallationParameters = {
  tenantId: "internal-demo",
  githubInstallationId: "",
  githubOwnerLogin: "",
  githubOwnerType: undefined,
  githubConnectionStatus: "disconnected",
  githubAuthMode: undefined,
  githubUserId: "",
  githubUserLogin: "",
  githubUserAuthorizationStatus: "missing",
  githubTokenExpiresAt: undefined,
  openAiSecretRef: "",
  previewTarget: "contentful-preview",
  productionTarget: "contentful-production",
  policyProfileId: "default",
  apiBaseUrl: DEFAULT_API_BASE_URL,
  featureFlags: {
    enablePreviewSync: true,
  },
};

export function mergeInstallationParameters(
  currentParameters: Partial<BuilderInstallationParameters> | undefined,
): BuilderInstallationParameters {
  return {
    ...DEFAULT_INSTALLATION_PARAMETERS,
    ...currentParameters,
    featureFlags: {
      ...DEFAULT_INSTALLATION_PARAMETERS.featureFlags,
      ...(currentParameters?.featureFlags ?? {}),
    },
  };
}
