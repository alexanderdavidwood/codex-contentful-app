import { init, type KnownAppSDK } from "@contentful/app-sdk";
import { Box, Heading, Note, Paragraph, Spinner } from "@contentful/f36-components";
import { SDKContext } from "@contentful/react-apps-toolkit";
import { useEffect, useState } from "react";

import { App } from "./App.js";
import { StandaloneApp } from "./StandaloneApp.js";

type BootstrapState =
  | { status: "loading" }
  | { status: "contentful"; sdk: KnownAppSDK }
  | { status: "standalone" }
  | { status: "sdk-timeout" };

const CONTENTFUL_INIT_TIMEOUT_MS = 10000;

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
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setState({ status: "sdk-timeout" });
      }
    }, CONTENTFUL_INIT_TIMEOUT_MS);

    init((sdk) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timeout);
        setState({ status: "contentful", sdk });
      }
    });

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <Box padding="spacingXl">
        <Spinner />
      </Box>
    );
  }

  if (state.status === "standalone") {
    return <StandaloneApp />;
  }

  if (state.status === "sdk-timeout") {
    return (
      <Box padding="spacingXl">
        <Heading>Waiting for Contentful</Heading>
        <Paragraph>
          This app is running inside an iframe, but the Contentful App SDK did not initialize in time.
        </Paragraph>
        <Note variant="warning">
          Confirm that this URL is configured as a Contentful app frontend and that the iframe is loading from the
          expected app location.
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
