import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Note,
  Paragraph,
  Spinner,
} from "@contentful/f36-components";

type HealthState =
  | { status: "idle" | "loading" }
  | { status: "ok"; payload: { apiBaseUrl: string; storage: string; environment: string } }
  | { status: "error"; message: string };

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";
}

export function StandaloneApp() {
  const [health, setHealth] = useState<HealthState>({ status: "idle" });
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  useEffect(() => {
    let isMounted = true;
    setHealth({ status: "loading" });

    fetch(`${apiBaseUrl}/health`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }

        return (await response.json()) as {
          apiBaseUrl: string;
          storage: string;
          environment: string;
        };
      })
      .then((payload) => {
        if (isMounted) {
          setHealth({ status: "ok", payload });
        }
      })
      .catch((error: Error) => {
        if (isMounted) {
          setHealth({ status: "error", message: error.message });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  return (
    <Flex
      flexDirection="column"
      gap="spacingL"
      style={{ minHeight: "100vh", padding: 24, maxWidth: 960, margin: "0 auto" }}
    >
      <Box
        padding="spacingXl"
        style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, #102542 0%, #1d3557 48%, #457b9d 100%)",
          color: "white",
        }}
      >
        <Flex flexDirection="column" gap="spacingM">
          <Badge variant="primary">Standalone preview</Badge>
          <Heading>Codex Builder is deployed</Heading>
          <Paragraph>
            This frontend is intended to run inside a Contentful app iframe. Outside Contentful, it shows this landing
            page instead of a blank screen.
          </Paragraph>
        </Flex>
      </Box>

      <Card>
        <Flex flexDirection="column" gap="spacingM">
          <Heading>Deployment check</Heading>
          <Paragraph>
            Configured API base URL: <code>{apiBaseUrl}</code>
          </Paragraph>
          {health.status === "loading" || health.status === "idle" ? (
            <Flex alignItems="center" gap="spacingS">
              <Spinner />
              <Paragraph marginBottom="none">Checking API health…</Paragraph>
            </Flex>
          ) : null}
          {health.status === "ok" ? (
            <Note variant="positive">
              API is reachable. Storage: <strong>{health.payload.storage}</strong>. Environment:{" "}
              <strong>{health.payload.environment}</strong>.
            </Note>
          ) : null}
          {health.status === "error" ? (
            <Note variant="warning">
              The frontend deployed correctly, but the API health check failed: <code>{health.message}</code>
            </Note>
          ) : null}
        </Flex>
      </Card>

      <Card>
        <Flex flexDirection="column" gap="spacingM">
          <Heading>Next steps</Heading>
          <Paragraph>Use this URL as the frontend host when you create the private Contentful app definition.</Paragraph>
          <Paragraph>
            Then install the app in Contentful and set the API base URL in the app configuration screen.
          </Paragraph>
          <Flex gap="spacingS" flexWrap="wrap">
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = `${apiBaseUrl}/health`;
              }}
            >
              Open API health
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Retry health check
            </Button>
          </Flex>
        </Flex>
      </Card>

      <Note variant="primary">
        Once the app is loaded inside Contentful, this landing page disappears and the real `ConfigScreen` or `Page`
        location renders instead.
      </Note>
    </Flex>
  );
}
