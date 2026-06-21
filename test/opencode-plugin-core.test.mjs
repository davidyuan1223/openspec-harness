import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVerifyCommand,
  createHarnessGateHook,
  extractArchiveChange,
  extractShellWritePaths
} from "../lib/opencode-plugin-core.js";

test("extractArchiveChange detects namespaced archive commands", () => {
  assert.equal(extractArchiveChange("openspec archive add-demo"), "add-demo");
  assert.equal(extractArchiveChange("openspec archive --yes add-demo"), "add-demo");
  assert.equal(extractArchiveChange("openspec validate --all"), null);
});

test("buildVerifyCommand builds CLI invocation", () => {
  assert.deepEqual(
    buildVerifyCommand({
      verifierPath: "/repo/bin/openspec-harness.mjs",
      change: "add-demo",
      cwd: "/repo",
      mode: "archive"
    }),
    [
      "/repo/bin/openspec-harness.mjs",
      "verify",
      "--mode",
      "archive",
      "--change",
      "add-demo",
      "--cwd",
      "/repo"
    ]
  );
});

test("extractShellWritePaths detects common shell writes", () => {
  assert.deepEqual(
    extractShellWritePaths("cat > /repo/src/app.js << 'EOF'\nexport {}\nEOF"),
    ["/repo/src/app.js"]
  );
  assert.deepEqual(extractShellWritePaths("printf hi | tee src/app.js"), ["src/app.js"]);
  assert.deepEqual(extractShellWritePaths("npm test > /dev/null"), ["/dev/null"]);
});

test("archive gate hook blocks failed verification", async () => {
  const calls = [];
  const hook = createHarnessGateHook({
    directory: "/repo",
    verifierPath: "/repo/bin/openspec-harness.mjs",
    nodePath: "/usr/bin/node",
    runner: (...args) => {
      calls.push(args);
      return { status: 1, stdout: "Implementation review is not approved", stderr: "" };
    }
  });

  await assert.rejects(
    () =>
      hook(
        { tool: "bash", sessionID: "s1", callID: "c1" },
        { args: { command: "openspec archive add-demo" } }
      ),
    /OpenSpec Harness blocked archive.*Implementation review/su
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], [
    "/repo/bin/openspec-harness.mjs",
    "verify",
    "--mode",
    "archive",
    "--change",
    "add-demo",
    "--cwd",
    "/repo"
  ]);
});

test("archive gate hook ignores unrelated commands", async () => {
  const hook = createHarnessGateHook({
    runner: () => {
      throw new Error("runner should not be called");
    }
  });

  await hook(
    { tool: "bash", sessionID: "s1", callID: "c1" },
    { args: { command: "openspec validate --all" } }
  );
});

test("implementation edit hook blocks edits before apply verification passes", async () => {
  const calls = [];
  const hook = createHarnessGateHook({
    directory: "/repo",
    verifierPath: "/repo/bin/openspec-harness.mjs",
    nodePath: "/usr/bin/node",
    changeResolver: async () => "add-demo",
    runner: (...args) => {
      calls.push(args);
      return { status: 1, stdout: "Business review is not approved", stderr: "" };
    }
  });

  await assert.rejects(
    () =>
      hook(
        { tool: "write", sessionID: "s1", callID: "c1" },
        { args: { filePath: "src/app.js" } }
      ),
    /blocked apply.*Business review is not approved/su
  );

  assert.deepEqual(calls[0][1], [
    "/repo/bin/openspec-harness.mjs",
    "verify",
    "--mode",
    "apply",
    "--change",
    "add-demo",
    "--cwd",
    "/repo"
  ]);
});

test("implementation hook blocks shell writes before apply verification passes", async () => {
  const hook = createHarnessGateHook({
    directory: "/repo",
    verifierPath: "/repo/bin/openspec-harness.mjs",
    changeResolver: async () => "add-demo",
    runner: () => ({ status: 1, stdout: "Business review is not approved", stderr: "" })
  });

  await assert.rejects(
    () =>
      hook(
        { tool: "bash", sessionID: "s1", callID: "c1" },
        { args: { command: "cat > /repo/src/app.js << 'EOF'\nexport {}\nEOF" } }
      ),
    /blocked apply.*Business review is not approved/su
  );
});

test("implementation hook allows shell writes to OpenSpec artifacts", async () => {
  const hook = createHarnessGateHook({
    directory: "/repo",
    runner: () => {
      throw new Error("runner should not be called");
    }
  });

  await hook(
    { tool: "bash", sessionID: "s1", callID: "c1" },
    { args: { command: "printf '%s\\n' ok | tee openspec/changes/add-demo/tasks.md" } }
  );
});

test("implementation edit hook allows OpenSpec artifact edits before apply gates", async () => {
  const hook = createHarnessGateHook({
    runner: () => {
      throw new Error("runner should not be called");
    }
  });

  await hook(
    { tool: "write", sessionID: "s1", callID: "c1" },
    { args: { filePath: "openspec/changes/add-demo/proposal.md" } }
  );
});
