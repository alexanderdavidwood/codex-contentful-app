import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../config.js";
import { MemoryStore } from "../storage/memoryStore.js";
import { GitHubUserAuthService } from "./githubUserAuthService.js";

test("GitHubUserAuthService encrypts and decrypts tokens", () => {
  const originalKey = config.gitHubTokenEncryptionKey;
  Object.assign(config, { gitHubTokenEncryptionKey: Buffer.alloc(32, 7).toString("base64") });

  try {
    const service = new GitHubUserAuthService(new MemoryStore());
    const ciphertext = service.encryptToken("secret-token");
    const plaintext = service.decryptToken(ciphertext);

    assert.notEqual(ciphertext, "secret-token");
    assert.equal(plaintext, "secret-token");
  } finally {
    Object.assign(config, { gitHubTokenEncryptionKey: originalKey });
  }
});
