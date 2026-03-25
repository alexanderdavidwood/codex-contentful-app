import test from "node:test";
import assert from "node:assert/strict";

import { createRedactor } from "./redaction.js";

test("createRedactor replaces configured secrets", () => {
  const redact = createRedactor(["super-secret-token"]);

  assert.equal(redact("token=super-secret-token"), "token=[REDACTED]");
});
