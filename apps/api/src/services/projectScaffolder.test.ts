import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { config } from "../config.js";
import { scaffoldManagedProjectWorkspace } from "./projectScaffolder.js";

test("scaffoldManagedProjectWorkspace creates a manifest-backed workspace", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex-builder-projects-"));
  const originalRoot = config.managedProjectRoot;
  Object.assign(config, { managedProjectRoot: tempRoot });

  const project = await scaffoldManagedProjectWorkspace(
    "test-project",
    "Test Project",
    "A test project",
    ["Page", "Sidebar"],
  );

  assert.match(project.workspacePath, /test-project$/);
  assert.equal(project.manifest.appName, "Test Project");

  await rm(tempRoot, { recursive: true, force: true });
  Object.assign(config, { managedProjectRoot: originalRoot });
});
