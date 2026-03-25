import { locations, type AppExtensionSDK, type PageExtensionSDK } from "@contentful/app-sdk";
import { Paragraph } from "@contentful/f36-components";
import { useSDK } from "@contentful/react-apps-toolkit";

import { ConfigScreen } from "./locations/ConfigScreen.js";
import { Page } from "./locations/Page.js";

export function App() {
  const sdk = useSDK<AppExtensionSDK | PageExtensionSDK>();

  if (sdk.location.is(locations.LOCATION_APP_CONFIG)) {
    return <ConfigScreen />;
  }

  if (sdk.location.is(locations.LOCATION_PAGE)) {
    return <Page />;
  }

  return <Paragraph>Unsupported location for the Codex Builder MVP.</Paragraph>;
}
