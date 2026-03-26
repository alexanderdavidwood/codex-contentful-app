import { Box, Spinner } from "@contentful/f36-components";
import { SDKProvider } from "@contentful/react-apps-toolkit";

import { App } from "./App.js";
import { StandaloneApp } from "./StandaloneApp.js";

function isTopLevelWindow() {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

export function Root() {
  if (isTopLevelWindow()) {
    return <StandaloneApp />;
  }

  return (
    <SDKProvider
      loading={
        <Box padding="spacingXl">
          <Spinner />
        </Box>
      }
    >
      <App />
    </SDKProvider>
  );
}
