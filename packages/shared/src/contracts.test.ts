import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultManifest, managedProjectManifestSchema } from "./contracts.js";

test("createDefaultManifest creates a valid managed project manifest", () => {
  const manifest = createDefaultManifest("Codex Builder Demo", ["Page", "Sidebar"]);
  const parsed = managedProjectManifestSchema.parse(manifest);

  assert.equal(parsed.appName, "Codex Builder Demo");
  assert.deepEqual(parsed.supportedSurfaces, ["Page", "Sidebar"]);
});
