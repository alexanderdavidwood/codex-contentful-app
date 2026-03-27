import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  FormControl,
  Heading,
  Note,
  Paragraph,
  Spinner,
  Table,
  TextInput,
  Textarea,
} from "@contentful/f36-components";
import type { PageExtensionSDK } from "@contentful/app-sdk";
import { useSDK } from "@contentful/react-apps-toolkit";

import {
  bootstrapBuilder,
  createProject,
  getConfigStatus,
  getProjectDetail,
  startRun,
  subscribeToRun,
} from "../api.js";
import { mergeInstallationParameters } from "../installation.js";
import type {
  BuilderConfigStatusResponse,
  BuilderInstallationParameters,
  BuilderProject,
  BuilderProjectDetail,
} from "../types.js";

function getInstallationParameters(sdk: PageExtensionSDK): BuilderInstallationParameters {
  return mergeInstallationParameters(
    (sdk.parameters.installation ?? {}) as Partial<BuilderInstallationParameters>,
  );
}

function getBadgeVariant(status: "passed" | "failed" | "warning" | "missing") {
  switch (status) {
    case "passed":
      return "positive" as const;
    case "warning":
      return "warning" as const;
    case "failed":
      return "negative" as const;
    default:
      return "secondary" as const;
  }
}

function SetupBlocker(props: {
  setupStatus: BuilderConfigStatusResponse | null;
  setupError: string | null;
  isCheckingSetup: boolean;
  onOpenConfig: () => void;
  onRetry: () => void;
}) {
  const blockers = props.setupStatus?.checks.filter((check) => check.status !== "passed") ?? [];

  return (
    <Flex flexDirection="column" gap="spacingL">
      <Box
        padding="spacingL"
        style={{
          borderRadius: 18,
          background: "linear-gradient(135deg, #102542 0%, #1d3557 55%, #457b9d 100%)",
          color: "white",
        }}
      >
        <Heading>Codex Builder Workspace</Heading>
        <Paragraph marginBottom="spacingS">
          This workspace is blocked until the builder configuration passes the required setup checks.
        </Paragraph>
        <Badge variant={props.setupStatus?.overall === "blocked" || props.setupError ? "negative" : "warning"}>
          {props.setupStatus?.overall === "ready"
            ? "Ready"
            : props.setupStatus?.overall === "blocked" || props.setupError
              ? "Blocked"
              : "Needs setup"}
        </Badge>
      </Box>

      <Note variant="warning" title="Complete setup first">
        The page location will not create projects or start Codex runs until the backend, GitHub, OpenAI, and target checks all pass.
      </Note>

      <Card>
        <Flex flexDirection="column" gap="spacingM">
          <Heading>What needs attention</Heading>
          {props.isCheckingSetup ? <Spinner /> : null}

          {props.setupError ? (
            <Note variant="negative" title="Setup check failed">
              {props.setupError}
            </Note>
          ) : null}

          {blockers.length === 0 && !props.setupError && !props.isCheckingSetup ? (
            <Paragraph marginBottom="none">
              No detailed blocker list is available yet. Re-run the checks or open the configuration screen.
            </Paragraph>
          ) : null}

          {blockers.map((check) => (
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
                  {check.details ? <Paragraph marginBottom="none">{check.details}</Paragraph> : null}
                </div>
                <Badge variant={getBadgeVariant(check.status)}>{check.status}</Badge>
              </Flex>
            </Box>
          ))}

          <Flex gap="spacingS" flexWrap="wrap">
            <Button variant="primary" onClick={props.onOpenConfig}>
              Open configuration
            </Button>
            <Button variant="secondary" onClick={props.onRetry} isDisabled={props.isCheckingSetup}>
              Re-run checks
            </Button>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
}

export function Page() {
  const sdk = useSDK<PageExtensionSDK>();
  const installation = useMemo(() => getInstallationParameters(sdk), [sdk]);
  const [projects, setProjects] = useState<BuilderProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectDetail, setProjectDetail] = useState<BuilderProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState("Managed app demo");
  const [projectDescription, setProjectDescription] = useState("Generated by the Codex-powered builder.");
  const [prompt, setPrompt] = useState("Create a sidebar experience that summarizes entry metadata and surfaces a preview call-to-action.");
  const [runLog, setRunLog] = useState<string[]>([]);
  const [activeRunId, setActiveRunId] = useState<string>("");
  const [setupStatus, setSetupStatus] = useState<BuilderConfigStatusResponse | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);

  async function refreshSetupStatus(options?: { notify?: boolean }) {
    setIsCheckingSetup(true);
    setSetupError(null);

    try {
      const nextStatus = await getConfigStatus(installation);
      setSetupStatus(nextStatus);
      if (options?.notify) {
        sdk.notifier.success("Setup checks completed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Setup checks failed.";
      setSetupStatus(null);
      setSetupError(message);
      if (options?.notify) {
        sdk.notifier.error(message);
      }
    } finally {
      setIsCheckingSetup(false);
    }
  }

  const isSetupReady = setupStatus?.overall === "ready";

  useEffect(() => {
    void refreshSetupStatus();
  }, [installation.apiBaseUrl, installation.githubInstallationId, installation.previewTarget, installation.productionTarget, installation.tenantId]);

  useEffect(() => {
    if (!isSetupReady) {
      setProjects([]);
      setSelectedProjectId("");
      setProjectDetail(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    bootstrapBuilder(installation)
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setProjects(response.projects);
        setSelectedProjectId((current) => current || response.projects[0]?.id || "");
      })
      .catch((error: Error) => sdk.notifier.error(error.message))
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [installation, isSetupReady, sdk]);

  useEffect(() => {
    if (!isSetupReady) {
      return;
    }

    if (!selectedProjectId) {
      setProjectDetail(null);
      return;
    }

    getProjectDetail(installation, selectedProjectId)
      .then(setProjectDetail)
      .catch((error: Error) => sdk.notifier.error(error.message));
  }, [installation, isSetupReady, sdk, selectedProjectId]);

  useEffect(() => {
    if (!isSetupReady) {
      return;
    }

    if (!activeRunId) {
      return;
    }

    const unsubscribe = subscribeToRun(installation, activeRunId, (event) => {
      setRunLog((current) => [...current, JSON.stringify(event)]);
      void getProjectDetail(installation, selectedProjectId)
        .then(setProjectDetail)
        .catch(() => undefined);
    });

    return unsubscribe;
  }, [activeRunId, installation, isSetupReady, selectedProjectId]);

  async function handleCreateProject() {
    const project = await createProject(installation, {
      tenantId: installation.tenantId,
      name: projectName,
      description: projectDescription,
      supportedSurfaces: ["ConfigScreen", "Page", "Sidebar"],
    });

    setProjects((current) => [project as BuilderProject, ...current]);
    setSelectedProjectId((project as BuilderProject).id);
    sdk.notifier.success("Managed project scaffold created.");
  }

  async function handleStartRun() {
    if (!selectedProjectId) {
      sdk.notifier.error("Create or select a project first.");
      return;
    }

    setRunLog([]);
    const response = await startRun(installation, selectedProjectId, prompt);
    setActiveRunId(response.runId);
    sdk.notifier.success("Codex run started.");
  }

  if (isCheckingSetup || !isSetupReady) {
    return (
      <SetupBlocker
        setupStatus={setupStatus}
        setupError={setupError}
        isCheckingSetup={isCheckingSetup}
        onOpenConfig={() => {
          void sdk.navigator.openAppConfig();
        }}
        onRetry={() => {
          void refreshSetupStatus({ notify: true });
        }}
      />
    );
  }

  return (
    <Flex flexDirection="column" gap="spacingL">
      <Box
        padding="spacingL"
        style={{
          borderRadius: 18,
          background: "linear-gradient(135deg, #102542 0%, #1d3557 55%, #457b9d 100%)",
          color: "white",
        }}
      >
        <Heading>Codex Builder Workspace</Heading>
        <Paragraph>
          Build managed Contentful apps from inside Contentful while keeping Codex execution on the server.
        </Paragraph>
        <Flex gap="spacingS" alignItems="center">
          <Badge variant="primary">{installation.tenantId}</Badge>
          <Badge variant="secondary">{installation.previewTarget}</Badge>
          <Badge variant="positive">{installation.productionTarget}</Badge>
        </Flex>
      </Box>

      <Note variant="warning">
        Stage 1 uses a Render-compatible demo backend. Expect cold starts and keep this limited to internal or tightly managed use.
      </Note>

      <Card>
        <Flex flexDirection="column" gap="spacingM">
          <Heading>Create a managed project</Heading>
          <FormControl>
            <FormControl.Label>Project name</FormControl.Label>
            <TextInput value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </FormControl>
          <FormControl>
            <FormControl.Label>Description</FormControl.Label>
            <Textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} />
          </FormControl>
          <Button variant="primary" onClick={() => void handleCreateProject()}>
            Create managed project
          </Button>
        </Flex>
      </Card>

      <Card>
        <Flex flexDirection="column" gap="spacingM">
          <Heading>Projects</Heading>
          {isLoading ? <Spinner /> : null}
          {projects.length === 0 && !isLoading ? <Paragraph>No projects yet.</Paragraph> : null}
          {projects.map((project) => (
            <Box
              key={project.id}
              padding="spacingM"
              style={{
                borderRadius: 12,
                border: project.id === selectedProjectId ? "2px solid #0f62fe" : "1px solid #dce3ec",
                cursor: "pointer",
              }}
              onClick={() => setSelectedProjectId(project.id)}
            >
              <Flex justifyContent="space-between" alignItems="center">
                <div>
                  <Heading marginBottom="none">{project.name}</Heading>
                  <Paragraph marginBottom="none">{project.description}</Paragraph>
                </div>
                <Badge variant="secondary">{project.manifest.supportedSurfaces.join(", ")}</Badge>
              </Flex>
            </Box>
          ))}
        </Flex>
      </Card>

      <Card>
        <Flex flexDirection="column" gap="spacingM">
          <Heading>Run Codex</Heading>
          <FormControl>
            <FormControl.Label>Prompt</FormControl.Label>
            <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
          </FormControl>
          <Button variant="primary" onClick={() => void handleStartRun()}>
            Start run
          </Button>
        </Flex>
      </Card>

      {projectDetail ? (
        <Card>
          <Flex flexDirection="column" gap="spacingM">
            <Heading>Project detail</Heading>
            <Paragraph>
              Workspace: <code>{projectDetail.project.workspacePath}</code>
            </Paragraph>
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.Cell>Status</Table.Cell>
                  <Table.Cell>Prompt</Table.Cell>
                  <Table.Cell>Updated</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {projectDetail.runs.map((run) => (
                  <Table.Row key={run.id}>
                    <Table.Cell>
                      <Badge variant={run.status === "succeeded" ? "positive" : run.status === "failed" ? "negative" : "primary"}>
                        {run.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{run.prompt}</Table.Cell>
                    <Table.Cell>{new Date(run.updatedAt).toLocaleString()}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Flex>
        </Card>
      ) : null}

      <Card>
        <Flex flexDirection="column" gap="spacingM">
          <Heading>Live run stream</Heading>
          <Box
            padding="spacingM"
            style={{
              borderRadius: 12,
              background: "#0f172a",
              color: "#dbeafe",
              fontFamily: "monospace",
              minHeight: 220,
              whiteSpace: "pre-wrap",
              overflowX: "auto",
            }}
          >
            {runLog.length > 0 ? runLog.join("\n") : "No run output yet."}
          </Box>
        </Flex>
      </Card>
    </Flex>
  );
}
