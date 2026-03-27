import test from "node:test";
import assert from "node:assert/strict";

import { GitHubAppAuthService } from "./githubAppAuthService.js";
import { GitHubRepositoryService } from "./githubRepositoryService.js";
import { GitHubUserAuthService } from "./githubUserAuthService.js";
import { MemoryStore } from "../storage/memoryStore.js";

test("GitHubRepositoryService builds repo names with prefix and bounded length", () => {
  const service = new GitHubRepositoryService(
    new GitHubAppAuthService(),
    new GitHubUserAuthService(new MemoryStore()),
  );
  const name = service.buildRepositoryName("A Very Long Project Name For A Managed Contentful Sidebar Experience");

  assert.match(name, /^codex-builder-/);
  assert.ok(name.length <= 63);
});
