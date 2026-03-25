import test from "node:test";
import assert from "node:assert/strict";

import { bootstrapBuilder } from "./api.js";

test("bootstrapBuilder is a function", () => {
  assert.equal(typeof bootstrapBuilder, "function");
});
