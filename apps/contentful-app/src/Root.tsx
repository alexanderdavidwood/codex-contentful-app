import { init, type KnownAppSDK } from "@contentful/app-sdk";
import { SDKContext } from "@contentful/react-apps-toolkit";
import { useEffect, useState } from "react";

import { App } from "./App.js";
import { StandaloneApp } from "./StandaloneApp.js";

type BootstrapState =
  | { status: "loading" }
  | { status: "contentful"; sdk: KnownAppSDK }
  | { status: "standalone" };

const CONTENTFUL_INIT_TIMEOUT_MS = 1800;

export function Root() {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setState({ status: "standalone" });
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
    return null;
  }

  if (state.status === "standalone") {
    return <StandaloneApp />;
  }

  return (
    <SDKContext.Provider value={{ sdk: state.sdk }}>
      <App />
    </SDKContext.Provider>
  );
}
