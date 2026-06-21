import assert from "node:assert/strict";
import test from "node:test";

test("OpenCode SDK can be imported for optional headless tests", { skip: !process.env.OPENSPEC_HARNESS_E2E }, async () => {
  const sdk = await import("@opencode-ai/sdk");
  assert.equal(typeof sdk.createOpencode, "function");
  assert.equal(typeof sdk.createOpencodeClient, "function");
});
