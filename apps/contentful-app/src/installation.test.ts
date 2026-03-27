import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_INSTALLATION_PARAMETERS,
  mergeInstallationParameters,
} from "./installation.js";

test("mergeInstallationParameters applies defaults and preserves feature flags", () => {
  const merged = mergeInstallationParameters({
    tenantId: "pilot-tenant",
    featureFlags: {
      enablePreviewSync: false,
      enableExperimentalStatusRail: true,
    },
  });

  assert.equal(merged.tenantId, "pilot-tenant");
  assert.equal(merged.apiBaseUrl, DEFAULT_INSTALLATION_PARAMETERS.apiBaseUrl);
  assert.equal(merged.previewTarget, "contentful-preview");
  assert.equal(merged.featureFlags.enablePreviewSync, false);
  assert.equal(merged.featureFlags.enableExperimentalStatusRail, true);
});
