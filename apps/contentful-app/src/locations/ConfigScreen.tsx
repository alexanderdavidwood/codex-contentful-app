import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  FormControl,
  Heading,
  Note,
  Paragraph,
  Pill,
  Spinner,
  TextLink,
  TextInput,
} from "@contentful/f36-components";
import type { AppExtensionSDK } from "@contentful/app-sdk";
import { useSDK } from "@contentful/react-apps-toolkit";

import {
  disconnectGitHub,
  getConfigStatus,
  getGitHubConnectSessionStatus,
  startGitHubConnectSession,
} from "../api.js";
import {
  DEFAULT_INSTALLATION_PARAMETERS,
  mergeInstallationParameters,
} from "../installation.js";
import type {
  BuilderConfigStatusResponse,
  BuilderGitHubConnectSessionStatusResponse,
  BuilderGitHubConnectionStatus,
  BuilderInstallationParameters,
} from "../types.js";

type AsyncState = "idle" | "loading";

type GitHubSessionState = {
  sessionId: string;
  status: BuilderGitHubConnectSessionStatusResponse["status"];
  authorizationStatus: BuilderGitHubConnectSessionStatusResponse["authorizationStatus"];
  connectUrl: string;
  expiresAt: string;
  errorMessage?: string;
};

function getBadgeVariant(status: string) {
  switch (status) {
    case "passed":
    case "ready":
    case "connected":
      return "positive" as const;
    case "warning":
    case "pending":
    case "needs_setup":
      return "warning" as const;
    case "failed":
    case "blocked":
    case "error":
      return "negative" as const;
    default:
      return "secondary" as const;
  }
}

function toSentenceCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getConfigSummary(
  configStatus: BuilderConfigStatusResponse | null,
  parameters: BuilderInstallationParameters,
) {
  const gitHubSummaryStatus =
    configStatus?.github.status === "connected" &&
    configStatus.github.userAuthorizationStatus !== "authorized"
      ? "warning"
      : configStatus?.github.status ?? (parameters.githubInstallationId ? "warning" : "disconnected");

  return {
    backend: configStatus?.backend.status ?? (parameters.apiBaseUrl ? "warning" : "missing"),
    github: gitHubSummaryStatus,
    openai: configStatus?.openai.status ?? "missing",
    targets:
      configStatus?.targets.previewTarget.status === "passed" &&
      configStatus.targets.productionTarget.status === "passed"
        ? "passed"
        : parameters.previewTarget && parameters.productionTarget
          ? "warning"
          : "missing",
    overall: configStatus?.overall ?? "needs_setup",
  };
}

function ConfigStatusRail(props: {
  parameters: BuilderInstallationParameters;
  configStatus: BuilderConfigStatusResponse | null;
  lastCheckedAt: string | null;
  checkError: string | null;
}) {
  const summary = getConfigSummary(props.configStatus, props.parameters);

  return (
    <Card>
      <Flex
        flexDirection="column"
        gap="spacingM"
        style={{ position: "sticky", top: 24 }}
      >
        <div>
          <Heading marginBottom="spacingXs">Setup status</Heading>
          <Paragraph marginBottom="none">
            Save partial configuration whenever you need to. The page location stays blocked until required checks pass.
          </Paragraph>
        </div>

        <Flex flexDirection="column" gap="spacingS">
          <Flex justifyContent="space-between" alignItems="center">
            <Paragraph marginBottom="none">Overall</Paragraph>
            <Badge variant={getBadgeVariant(summary.overall)}>{toSentenceCase(summary.overall)}</Badge>
          </Flex>
          <Flex justifyContent="space-between" alignItems="center">
            <Paragraph marginBottom="none">Backend</Paragraph>
            <Badge variant={getBadgeVariant(summary.backend)}>{toSentenceCase(summary.backend)}</Badge>
          </Flex>
          <Flex justifyContent="space-between" alignItems="center">
            <Paragraph marginBottom="none">GitHub</Paragraph>
            <Badge variant={getBadgeVariant(summary.github)}>{toSentenceCase(summary.github)}</Badge>
          </Flex>
          <Flex justifyContent="space-between" alignItems="center">
            <Paragraph marginBottom="none">OpenAI</Paragraph>
            <Badge variant={getBadgeVariant(summary.openai)}>{toSentenceCase(summary.openai)}</Badge>
          </Flex>
          <Flex justifyContent="space-between" alignItems="center">
            <Paragraph marginBottom="none">Targets</Paragraph>
            <Badge variant={getBadgeVariant(summary.targets)}>{toSentenceCase(summary.targets)}</Badge>
          </Flex>
        </Flex>

        {props.lastCheckedAt ? (
          <Note variant="neutral" title="Latest check">
            {new Date(props.lastCheckedAt).toLocaleString()}
          </Note>
        ) : null}

        {props.checkError ? (
          <Note variant="negative" title="Check error">
            {props.checkError}
          </Note>
        ) : null}
      </Flex>
    </Card>
  );
}

function CheckList(props: { configStatus: BuilderConfigStatusResponse | null }) {
  if (!props.configStatus) {
    return (
      <Paragraph marginBottom="none">
        Run the backend checks once to populate the detailed status list.
      </Paragraph>
    );
  }

  return (
    <Flex flexDirection="column" gap="spacingS">
      {props.configStatus.checks.map((check) => (
        <Box
          key={check.key}
          padding="spacingM"
          style={{
            borderRadius: 12,
            border: "1px solid #d7dee8",
            background: "#f8fafc",
          }}
        >
          <Flex justifyContent="space-between" alignItems="flex-start" gap="spacingM">
            <div>
              <Heading as="h3" marginBottom="spacing2Xs">
                {check.label}
              </Heading>
              <Paragraph marginBottom="spacing2Xs">{check.summary}</Paragraph>
              {check.details ? (
                <Paragraph marginBottom="none" style={{ color: "#52667a" }}>
                  {check.details}
                </Paragraph>
              ) : null}
            </div>
            <Badge variant={getBadgeVariant(check.status)}>{toSentenceCase(check.status)}</Badge>
          </Flex>
        </Box>
      ))}
    </Flex>
  );
}

export function ConfigScreen() {
  const sdk = useSDK<AppExtensionSDK>();
  const [parameters, setParameters] = useState<BuilderInstallationParameters>(DEFAULT_INSTALLATION_PARAMETERS);
  const parametersRef = useRef(parameters);
  const popupRef = useRef<Window | null>(null);
  const [configStatus, setConfigStatus] = useState<BuilderConfigStatusResponse | null>(null);
  const [checkState, setCheckState] = useState<AsyncState>("idle");
  const [saveState, setSaveState] = useState<AsyncState>("idle");
  const [githubState, setGitHubState] = useState<AsyncState>("idle");
  const [gitHubSession, setGitHubSession] = useState<GitHubSessionState | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [hasHydratedParameters, setHasHydratedParameters] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() => window.innerWidth < 1080);

  useEffect(() => {
    parametersRef.current = parameters;
  }, [parameters]);

  useEffect(() => {
    const currentParameters = sdk.parameters.installation as Partial<BuilderInstallationParameters> | undefined;
    setParameters(mergeInstallationParameters(currentParameters));
    setHasHydratedParameters(true);
  }, [sdk]);

  useEffect(() => {
    const onResize = () => {
      setIsCompactLayout(window.innerWidth < 1080);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    sdk.app.onConfigure(async () => {
      setSaveState("loading");
      const targetState = await sdk.app.getCurrentState();
      setSaveState("idle");
      return {
        parameters: parametersRef.current,
        targetState,
      };
    });

    sdk.app.onConfigurationCompleted((error) => {
      if (error) {
        sdk.notifier.error(error.message);
        return;
      }

      sdk.notifier.success("Codex Builder configuration saved.");
    });
  }, [sdk]);

  async function runChecks(options?: { notify?: boolean }) {
    if (!parameters.apiBaseUrl.trim()) {
      const message = "Enter the backend API base URL before running checks.";
      setCheckError(message);
      if (options?.notify) {
        sdk.notifier.error(message);
      }
      return;
    }

    try {
      new URL(parameters.apiBaseUrl);
    } catch {
      const message = "API base URL must be a valid absolute URL.";
      setCheckError(message);
      if (options?.notify) {
        sdk.notifier.error(message);
      }
      return;
    }

    setCheckState("loading");
    setCheckError(null);

    try {
      const nextStatus = await getConfigStatus(parameters);
      setConfigStatus(nextStatus);
      setLastCheckedAt(new Date().toISOString());

      if (nextStatus.github.status === "connected") {
        setParameters((current) => ({
          ...current,
          githubInstallationId: nextStatus.github.installationId ?? current.githubInstallationId,
          githubOwnerLogin: nextStatus.github.ownerLogin ?? current.githubOwnerLogin,
          githubOwnerType: nextStatus.github.ownerType ?? current.githubOwnerType,
          githubAuthMode: nextStatus.github.authMode ?? current.githubAuthMode,
          githubUserId: nextStatus.github.githubUserId ?? current.githubUserId,
          githubUserLogin: nextStatus.github.githubUserLogin ?? current.githubUserLogin,
          githubConnectionStatus: nextStatus.github.status,
          githubUserAuthorizationStatus:
            nextStatus.github.userAuthorizationStatus ?? current.githubUserAuthorizationStatus,
          githubTokenExpiresAt: nextStatus.github.tokenExpiresAt ?? current.githubTokenExpiresAt,
        }));
      }

      if (options?.notify) {
        sdk.notifier.success("Setup checks completed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Setup checks failed.";
      setConfigStatus(null);
      setCheckError(message);
      if (options?.notify) {
        sdk.notifier.error(message);
      }
    } finally {
      setCheckState("idle");
    }
  }

  useEffect(() => {
    if (!hasHydratedParameters) {
      return;
    }

    void runChecks();
  }, [hasHydratedParameters]);

  useEffect(() => {
    if (!gitHubSession || gitHubSession.status !== "pending") {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const sessionStatus = await getGitHubConnectSessionStatus(parameters, gitHubSession.sessionId);
          if (cancelled) {
            return;
          }

          if (sessionStatus.status === "connected") {
            setGitHubSession((current) =>
              current
                ? {
                    ...current,
                    status: sessionStatus.status,
                    authorizationStatus: sessionStatus.authorizationStatus,
                  }
                : current,
            );
            popupRef.current?.close();
            popupRef.current = null;
            await runChecks({ notify: true });
            return;
          }

          if (sessionStatus.status === "failed" || sessionStatus.status === "expired") {
            setGitHubSession((current) =>
              current
                ? {
                    ...current,
                    status: sessionStatus.status,
                    authorizationStatus: sessionStatus.authorizationStatus,
                    errorMessage: sessionStatus.errorMessage,
                  }
                : current,
            );
            popupRef.current?.close();
            popupRef.current = null;
            setCheckError(sessionStatus.errorMessage ?? "GitHub connection did not complete.");
            return;
          }

          setGitHubSession((current) =>
            current
              ? {
                  ...current,
                  authorizationStatus: sessionStatus.authorizationStatus,
                }
              : current,
          );
        } catch (error) {
          if (!cancelled) {
            setCheckError(error instanceof Error ? error.message : "GitHub session polling failed.");
          }
        }
      })();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [gitHubSession, parameters]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const apiOrigin = (() => {
        try {
          return new URL(parameters.apiBaseUrl).origin;
        } catch {
          return null;
        }
      })();
      if (apiOrigin && event.origin !== apiOrigin) {
        return;
      }

      const message = event.data as { type?: string; sessionId?: string };
      if (message.type === "codex-builder:github-connected" && message.sessionId) {
        setGitHubSession((current) =>
          current && current.sessionId === message.sessionId
            ? { ...current, status: "connected" }
            : current,
        );
        void runChecks({ notify: true });
      }

      if (message.type === "codex-builder:github-failed") {
        setCheckError("GitHub connection failed. Review the popup and try again.");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [parameters.apiBaseUrl]);

  async function handleConnectGitHub() {
    if (!parameters.apiBaseUrl.trim()) {
      sdk.notifier.error("Set the backend API base URL before connecting GitHub.");
      return;
    }

    if (configStatus?.backend.githubConfigured === false) {
      sdk.notifier.error("The backend is missing GitHub App installation configuration.");
      return;
    }

    if (configStatus?.backend.githubUserAuthConfigured === false) {
      sdk.notifier.error("The backend is missing GitHub user authorization configuration.");
      return;
    }

    setGitHubState("loading");
    setCheckError(null);

    try {
      const session = await startGitHubConnectSession(
        parameters,
        {
          organizationId: sdk.ids.organization,
          appId: sdk.ids.app,
          environmentId: sdk.ids.environment,
          spaceId: sdk.ids.space,
          userId: sdk.ids.user,
        },
        window.location.href,
      );

      setGitHubSession({
        sessionId: session.sessionId,
        status: "pending",
        authorizationStatus: "awaiting_installation",
        connectUrl: session.connectUrl,
        expiresAt: session.expiresAt,
      });

      setParameters((current) => ({
        ...current,
        githubConnectionStatus: "pending",
        githubUserAuthorizationStatus: "awaiting_authorization",
      }));

      popupRef.current = window.open(
        session.connectUrl,
        "codex-builder-github-install",
        "popup=yes,width=720,height=820,resizable=yes,scrollbars=yes",
      );

      if (!popupRef.current) {
        setCheckError("The GitHub popup was blocked. Use the fallback link below.");
        sdk.notifier.warning("The GitHub popup was blocked.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub connection could not be started.";
      setCheckError(message);
      sdk.notifier.error(message);
    } finally {
      setGitHubState("idle");
    }
  }

  async function handleDisconnectGitHub() {
    setGitHubState("loading");

    try {
      const connection = await disconnectGitHub(parameters);
      setGitHubSession(null);
      setParameters((current) => ({
        ...current,
        githubInstallationId: "",
        githubOwnerLogin: "",
        githubOwnerType: undefined,
        githubAuthMode: undefined,
        githubUserId: "",
        githubUserLogin: "",
        githubConnectionStatus: connection.status,
        githubUserAuthorizationStatus: connection.userAuthorizationStatus,
        githubTokenExpiresAt: undefined,
      }));
      await runChecks({ notify: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub disconnect failed.";
      setCheckError(message);
      sdk.notifier.error(message);
    } finally {
      setGitHubState("idle");
    }
  }

  const overview = useMemo(() => getConfigSummary(configStatus, parameters), [configStatus, parameters]);
  const gitHubConnection: BuilderGitHubConnectionStatus = configStatus?.github ?? {
    status: parameters.githubConnectionStatus ?? "disconnected",
    installationId: parameters.githubInstallationId || undefined,
    ownerLogin: parameters.githubOwnerLogin || undefined,
    ownerType: parameters.githubOwnerType,
    authMode: parameters.githubAuthMode,
    githubUserId: parameters.githubUserId || undefined,
    githubUserLogin: parameters.githubUserLogin || undefined,
    userAuthorizationStatus: parameters.githubUserAuthorizationStatus,
    tokenExpiresAt: parameters.githubTokenExpiresAt,
  };
  const statusRail = (
    <ConfigStatusRail
      parameters={parameters}
      configStatus={configStatus}
      lastCheckedAt={lastCheckedAt}
      checkError={checkError}
    />
  );

  return (
    <Box
      paddingTop="spacingL"
      paddingBottom="spacingXl"
      paddingLeft="spacingL"
      paddingRight="spacingL"
    >
      <Box style={{ maxWidth: 1120, margin: "0 auto" }}>
        <Box
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: isCompactLayout
              ? "minmax(0, 1fr)"
              : "minmax(0, 1.8fr) minmax(300px, 0.9fr)",
            alignItems: "start",
          }}
        >
          {isCompactLayout ? statusRail : null}

          <Flex flexDirection="column" gap="spacingL">
            <Card>
              <Flex flexDirection="column" gap="spacingM">
                <div>
                  <Heading>Codex Builder Setup</Heading>
                  <Paragraph marginBottom="spacingS">
                    Configure the backend, GitHub owner, and deployment targets that the builder needs before the page location can create managed Contentful apps.
                  </Paragraph>
                  <Paragraph marginBottom="none" style={{ color: "#52667a" }}>
                    You can save partial setup. The builder workspace stays blocked until the required backend, GitHub, OpenAI, and target checks pass.
                  </Paragraph>
                </div>

                <Flex gap="spacingS" flexWrap="wrap">
                  <Pill label={`Backend ${toSentenceCase(overview.backend)}`} variant={overview.backend === "passed" ? "active" : "idle"} />
                  <Pill label={`GitHub ${toSentenceCase(overview.github)}`} variant={overview.github === "connected" ? "active" : "idle"} />
                  <Pill label={`OpenAI ${toSentenceCase(overview.openai)}`} variant={overview.openai === "passed" ? "active" : "idle"} />
                  <Pill label={`Targets ${toSentenceCase(overview.targets)}`} variant={overview.targets === "passed" ? "active" : "idle"} />
                </Flex>
              </Flex>
            </Card>

            <Card>
              <Flex flexDirection="column" gap="spacingM">
                <div>
                  <Heading>Backend</Heading>
                  <Paragraph marginBottom="spacingS">
                    Point the app at the public Render API URL and validate that the MVP backend responds from Contentful.
                  </Paragraph>
                </div>

                <FormControl>
                  <FormControl.Label>API base URL</FormControl.Label>
                  <TextInput
                    value={parameters.apiBaseUrl}
                    onChange={(event) =>
                      setParameters((current) => ({
                        ...current,
                        apiBaseUrl: event.target.value,
                      }))
                    }
                  />
                  <FormControl.HelpText>
                    Example: <code>https://codex-contentful-app-api.onrender.com</code>
                  </FormControl.HelpText>
                </FormControl>

                <Flex gap="spacingS" alignItems="center" flexWrap="wrap">
                  <Button
                    variant="secondary"
                    onClick={() => void runChecks({ notify: true })}
                    isDisabled={checkState === "loading"}
                  >
                    Check backend connection
                  </Button>
                  {checkState === "loading" ? <Spinner /> : null}
                </Flex>

                <Note variant="primary" title="Render MVP guidance">
                  Set <code>OPENAI_API_KEY</code> on the Render API service, deploy the expected branch, confirm <code>/health</code> is reachable, and use the public Render URL here.
                </Note>

                {configStatus ? (
                  <Box
                    padding="spacingM"
                    style={{
                      borderRadius: 12,
                      border: "1px solid #d7dee8",
                      background: "#f8fafc",
                    }}
                  >
                    <Flex flexDirection="column" gap="spacingS">
                      <Flex justifyContent="space-between" alignItems="center">
                        <Paragraph marginBottom="none">Reachability</Paragraph>
                        <Badge variant={getBadgeVariant(configStatus.backend.status)}>
                          {toSentenceCase(configStatus.backend.status)}
                        </Badge>
                      </Flex>
                      <Paragraph marginBottom="none">Environment: {configStatus.backend.environment ?? "unknown"}</Paragraph>
                      <Paragraph marginBottom="none">Storage: {configStatus.backend.storage ?? "unknown"}</Paragraph>
                      <Paragraph marginBottom="none">
                        Runner: {configStatus.backend.runnerCapabilities.batchRuns ? "batch" : "no batch"} /{" "}
                        {configStatus.backend.runnerCapabilities.interactiveSessions ? "interactive" : "no interactive"}
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        OpenAI available: {configStatus.backend.openAiConfigured ? "yes" : "no"}
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        GitHub App configured: {configStatus.backend.githubConfigured ? "yes" : "no"}
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        GitHub user auth configured: {configStatus.backend.githubUserAuthConfigured ? "yes" : "no"}
                      </Paragraph>
                    </Flex>
                  </Box>
                ) : null}
              </Flex>
            </Card>

            <Card>
              <Flex flexDirection="column" gap="spacingM">
                <div>
                  <Heading>GitHub</Heading>
                  <Paragraph marginBottom="spacingS">
                    Install the GitHub App into the target owner, then complete the GitHub user authorization step. This MVP only creates new managed repositories in the connected owner.
                  </Paragraph>
                </div>

                <Note variant="warning" title="Least privilege">
                  Use selected repositories only. The builder does not support arbitrary existing repositories in this phase.
                </Note>

                {!configStatus?.backend.githubConfigured ? (
                  <Note variant="warning" title="Missing GitHub App env vars">
                    Add <code>GITHUB_APP_ID</code>, <code>GITHUB_APP_NAME</code>, and <code>GITHUB_APP_PRIVATE_KEY</code> on the backend.
                  </Note>
                ) : null}

                {configStatus?.backend.githubConfigured && !configStatus.backend.githubUserAuthConfigured ? (
                  <Note variant="warning" title="Missing GitHub user auth env vars">
                    Add <code>GITHUB_APP_CLIENT_ID</code>, <code>GITHUB_APP_CLIENT_SECRET</code>, and <code>GITHUB_TOKEN_ENCRYPTION_KEY</code> on the backend.
                  </Note>
                ) : null}

                <Flex gap="spacingS" alignItems="center" flexWrap="wrap">
                  <Badge variant={getBadgeVariant(gitHubConnection.status)}>
                    {toSentenceCase(gitHubConnection.status)}
                  </Badge>
                  {gitHubConnection.ownerLogin ? (
                    <Paragraph marginBottom="none">
                      Connected owner: <strong>{gitHubConnection.ownerLogin}</strong>
                    </Paragraph>
                  ) : null}
                </Flex>

                {gitHubConnection.status === "connected" ? (
                  <Box
                    padding="spacingM"
                    style={{
                      borderRadius: 12,
                      border: "1px solid #d7dee8",
                      background: "#f8fafc",
                    }}
                  >
                    <Flex flexDirection="column" gap="spacingS">
                      <Paragraph marginBottom="none">
                        Installation ID: <code>{gitHubConnection.installationId ?? "unknown"}</code>
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        Owner type: {gitHubConnection.ownerType ?? "unknown"}
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        Repository selection: {gitHubConnection.repositorySelection ?? "selected"}
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        Auth mode: {gitHubConnection.authMode ?? "unknown"}
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        Authorized GitHub user: {gitHubConnection.githubUserLogin ?? "unknown"}
                      </Paragraph>
                      <Paragraph marginBottom="none">
                        User authorization: {toSentenceCase(gitHubConnection.userAuthorizationStatus ?? "missing")}
                      </Paragraph>
                      {gitHubConnection.tokenExpiresAt ? (
                        <Paragraph marginBottom="none">
                          User token expiry: {new Date(gitHubConnection.tokenExpiresAt).toLocaleString()}
                        </Paragraph>
                      ) : null}
                      <Paragraph marginBottom="none">Repository model: New managed repositories only</Paragraph>
                      {gitHubConnection.installationUrl ? (
                        <Paragraph marginBottom="none">
                          <TextLink href={gitHubConnection.installationUrl} target="_blank" rel="noreferrer">
                            View GitHub installation
                          </TextLink>
                        </Paragraph>
                      ) : null}
                    </Flex>
                  </Box>
                ) : null}

                {gitHubSession ? (
                  <Note
                    variant={gitHubSession.status === "pending" ? "primary" : gitHubSession.status === "connected" ? "positive" : "warning"}
                    title={gitHubSession.status === "pending" ? "GitHub connection in progress" : "GitHub connection session"}
                  >
                    {gitHubSession.status === "pending"
                      ? gitHubSession.authorizationStatus === "awaiting_authorization"
                        ? `GitHub installation completed. Finish the GitHub user authorization flow before ${new Date(gitHubSession.expiresAt).toLocaleTimeString()}.`
                        : `Finish the GitHub App installation flow before ${new Date(gitHubSession.expiresAt).toLocaleTimeString()}.`
                      : gitHubSession.errorMessage ?? "The session has completed."}
                  </Note>
                ) : null}

                <Flex gap="spacingS" alignItems="center" flexWrap="wrap">
                  <Button
                    variant="primary"
                    onClick={() => void handleConnectGitHub()}
                    isDisabled={githubState === "loading"}
                  >
                    {gitHubConnection.status === "connected" ? "Reconnect GitHub" : "Install and authorize GitHub"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void handleDisconnectGitHub()}
                    isDisabled={githubState === "loading" || gitHubConnection.status === "disconnected"}
                  >
                    Disconnect
                  </Button>
                  {githubState === "loading" ? <Spinner /> : null}
                </Flex>

                {gitHubSession?.connectUrl ? (
                  <Paragraph marginBottom="none">
                    Popup blocked?{" "}
                    <TextLink href={gitHubSession.connectUrl} target="_blank" rel="noreferrer">
                      Open the GitHub install flow in a new tab
                    </TextLink>
                    .
                  </Paragraph>
                ) : null}
              </Flex>
            </Card>

            <Card>
              <Flex flexDirection="column" gap="spacingM">
                <div>
                  <Heading>OpenAI and backend secrets</Heading>
                  <Paragraph marginBottom="spacingS">
                    This MVP keeps the OpenAI key on the backend. The Contentful iframe does not store or transmit the secret directly.
                  </Paragraph>
                </div>

                <Note variant="primary" title="Operator instructions">
                  Set <code>OPENAI_API_KEY</code> on the deployed backend. This screen only records an optional reference and re-checks whether the backend reports the key as available.
                </Note>

                <FormControl>
                  <FormControl.Label>OpenAI secret reference</FormControl.Label>
                  <TextInput
                    value={parameters.openAiSecretRef ?? ""}
                    onChange={(event) =>
                      setParameters((current) => ({
                        ...current,
                        openAiSecretRef: event.target.value,
                      }))
                    }
                  />
                  <FormControl.HelpText>
                    Optional operator note, for example <code>render:OPENAI_API_KEY</code>.
                  </FormControl.HelpText>
                </FormControl>

                <Flex gap="spacingS" alignItems="center" flexWrap="wrap">
                  <Badge variant={getBadgeVariant(configStatus?.openai.status ?? "missing")}>
                    {toSentenceCase(configStatus?.openai.status ?? "missing")}
                  </Badge>
                  <Paragraph marginBottom="none">
                    {configStatus?.openai.summary ?? "Run checks to validate backend OpenAI availability."}
                  </Paragraph>
                </Flex>
              </Flex>
            </Card>

            <Card>
              <Flex flexDirection="column" gap="spacingM">
                <div>
                  <Heading>Preview and production targets</Heading>
                  <Paragraph marginBottom="spacingS">
                    Use simple environment labels for the current MVP. These labels tell the builder which preview context to test against and which production target to promote into later.
                  </Paragraph>
                </div>

                <FormControl>
                  <FormControl.Label>Preview target</FormControl.Label>
                  <TextInput
                    value={parameters.previewTarget}
                    onChange={(event) =>
                      setParameters((current) => ({
                        ...current,
                        previewTarget: event.target.value,
                      }))
                    }
                  />
                  <FormControl.HelpText>
                    Example: <code>contentful-preview</code>
                  </FormControl.HelpText>
                </FormControl>

                <FormControl>
                  <FormControl.Label>Production target</FormControl.Label>
                  <TextInput
                    value={parameters.productionTarget}
                    onChange={(event) =>
                      setParameters((current) => ({
                        ...current,
                        productionTarget: event.target.value,
                      }))
                    }
                  />
                  <FormControl.HelpText>
                    Example: <code>contentful-production</code>
                  </FormControl.HelpText>
                </FormControl>

                <Flex gap="spacingS" flexWrap="wrap">
                  <Badge variant={getBadgeVariant(configStatus?.targets.previewTarget.status ?? "missing")}>
                    Preview {toSentenceCase(configStatus?.targets.previewTarget.status ?? "missing")}
                  </Badge>
                  <Badge variant={getBadgeVariant(configStatus?.targets.productionTarget.status ?? "missing")}>
                    Production {toSentenceCase(configStatus?.targets.productionTarget.status ?? "missing")}
                  </Badge>
                </Flex>
              </Flex>
            </Card>

            <Card>
              <Flex flexDirection="column" gap="spacingM">
                <Heading>Advanced settings</Heading>

                <Accordion>
                  <Accordion.Item title="Tenant, policy, and recovery details">
                    <Flex flexDirection="column" gap="spacingM">
                      <FormControl>
                        <FormControl.Label>Tenant ID</FormControl.Label>
                        <TextInput
                          value={parameters.tenantId}
                          onChange={(event) =>
                            setParameters((current) => ({
                              ...current,
                              tenantId: event.target.value,
                            }))
                          }
                        />
                      </FormControl>

                      <FormControl>
                        <FormControl.Label>Policy profile ID</FormControl.Label>
                        <TextInput
                          value={parameters.policyProfileId}
                          onChange={(event) =>
                            setParameters((current) => ({
                              ...current,
                              policyProfileId: event.target.value,
                            }))
                          }
                        />
                      </FormControl>

                      <FormControl>
                        <FormControl.Label>Manual GitHub installation ID</FormControl.Label>
                        <TextInput
                          value={parameters.githubInstallationId ?? ""}
                          onChange={(event) =>
                            setParameters((current) => ({
                              ...current,
                              githubInstallationId: event.target.value,
                            }))
                          }
                        />
                        <FormControl.HelpText>
                          Internal recovery field only. The backend GitHub connection record remains authoritative.
                        </FormControl.HelpText>
                      </FormControl>

                      <Checkbox
                        isChecked={Boolean(parameters.featureFlags.enablePreviewSync)}
                        onChange={(event) =>
                          setParameters((current) => ({
                            ...current,
                            featureFlags: {
                              ...current.featureFlags,
                              enablePreviewSync: event.target.checked,
                            },
                          }))
                        }
                      >
                        Enable preview sync messaging
                      </Checkbox>

                      {(parameters.githubOwnerLogin || parameters.githubConnectionStatus) ? (
                        <Note variant="neutral" title="Saved GitHub metadata">
                          <Paragraph marginBottom="spacing2Xs">
                            Owner: {parameters.githubOwnerLogin || "not saved"}
                          </Paragraph>
                          <Paragraph marginBottom="spacing2Xs">
                            Owner type: {parameters.githubOwnerType || "not saved"}
                          </Paragraph>
                          <Paragraph marginBottom="spacing2Xs">
                            Authorized user: {parameters.githubUserLogin || "not saved"}
                          </Paragraph>
                          <Paragraph marginBottom="spacing2Xs">
                            Auth mode: {parameters.githubAuthMode || "not saved"}
                          </Paragraph>
                          <Paragraph marginBottom="none">
                            Connection state: {parameters.githubConnectionStatus || "not saved"}
                          </Paragraph>
                        </Note>
                      ) : null}
                    </Flex>
                  </Accordion.Item>
                </Accordion>
              </Flex>
            </Card>

            <Card>
              <Flex flexDirection="column" gap="spacingM">
                <div>
                  <Heading>Setup status and save</Heading>
                  <Paragraph marginBottom="spacingS">
                    Save is always allowed. Use checks to confirm what is still missing before the builder workspace becomes available.
                  </Paragraph>
                </div>

                <CheckList configStatus={configStatus} />

                <Flex gap="spacingS" alignItems="center" flexWrap="wrap">
                  <Button
                    variant="primary"
                    onClick={() => {
                      sdk.notifier.success("Use Contentful’s Save or Install button to persist this configuration.");
                    }}
                    isDisabled={saveState === "loading"}
                  >
                    Save configuration
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void runChecks({ notify: true })}
                    isDisabled={checkState === "loading"}
                  >
                    Re-run checks
                  </Button>
                  <TextLink
                    href="https://render.com/docs/web-services"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open backend docs
                  </TextLink>
                  {saveState === "loading" || checkState === "loading" ? <Spinner /> : null}
                </Flex>
              </Flex>
            </Card>
          </Flex>

          {!isCompactLayout ? statusRail : null}
        </Box>
      </Box>
    </Box>
  );
}
