import { init, type KnownAppSDK } from "@contentful/app-sdk";
import { Box, Heading, Note, Paragraph, Spinner } from "@contentful/f36-components";
import { SDKContext } from "@contentful/react-apps-toolkit";
import { useEffect, useState } from "react";

import { App } from "./App.js";
import { StandaloneApp } from "./StandaloneApp.js";

const CONTENTFUL_INIT_TIMEOUT_MS = 8000;

type BootstrapState =
  | { status: "loading" }
  | { status: "contentful"; sdk: KnownAppSDK }
  | { status: "standalone" }
  | { status: "timeout" }
  | { status: "error"; message: string };

function isTopLevelWindow() {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

export function Root() {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    if (isTopLevelWindow()) {
      setState({ status: "standalone" });
      return;
    }

    let settled = false;

    const handleError = (event: ErrorEvent) => {
      if (!settled) {
        settled = true;
        setState({ status: "error", message: event.message || "Unknown runtime error" });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!settled) {
        settled = true;
        const reason =
          typeof event.reason === "string"
            ? event.reason
            : event.reason instanceof Error
              ? event.reason.message
              : "Unhandled promise rejection";
        setState({ status: "error", message: reason });
      }
    };

    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setState({ status: "timeout" });
      }
    }, CONTENTFUL_INIT_TIMEOUT_MS);

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    init((sdk) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timeout);
        setState({ status: "contentful", sdk });
      }
    });

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  if (state.status === "standalone") {
    return <StandaloneApp />;
  }

  if (state.status === "loading") {
    return (
      <Box padding="spacingXl">
        <Spinner />
        <Paragraph marginTop="spacingM" marginBottom="none">
          Connecting to the Contentful App SDK...
        </Paragraph>
      </Box>
    );
  }

  if (state.status === "timeout") {
    return (
      <Box padding="spacingXl">
        <Heading>Waiting for Contentful SDK</Heading>
        <Paragraph>
          The hosted bundle loaded, but the Contentful SDK did not initialize within 8 seconds.
        </Paragraph>
        <Note variant="warning">
          This usually means the iframe loaded, but the app handshake did not complete for the current location.
        </Note>
      </Box>
    );
  }

  if (state.status === "error") {
    return (
      <Box padding="spacingXl">
        <Heading>Runtime Error</Heading>
        <Paragraph>
          The app threw an error before it finished booting.
        </Paragraph>
        <Note variant="negative">
          <code>{state.message}</code>
        </Note>
      </Box>
    );
  }

  return (
    <SDKContext.Provider value={{ sdk: state.sdk }}>
      <App />
    </SDKContext.Provider>
  );
}
