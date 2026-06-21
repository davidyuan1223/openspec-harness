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
  assert.equal(extractArchiveChange("op\"enspec\" archive add-demo"), "add-demo");
  assert.equal(extractArchiveChange("'openspec' archive add-demo"), "add-demo");
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
  assert.deepEqual(
    extractShellWritePaths("node -e \"if (arr[j] > arr[j + 1]) console.log('swap')\""),
    []
  );
  assert.deepEqual(extractShellWritePaths("printf hi | tee src/app.js"), ["src/app.js"]);
  assert.deepEqual(extractShellWritePaths("npm test > /dev/null"), ["/dev/null"]);
  assert.deepEqual(extractShellWritePaths("cp /tmp/app.js /repo/src/app.js"), ["/repo/src/app.js"]);
  assert.deepEqual(extractShellWritePaths("mv /tmp/app.js src/app.js"), ["src/app.js"]);
  assert.deepEqual(
    extractShellWritePaths("Set-Content -Path C:\\repo\\src\\app.js -Value 'ok'"),
    ["C:\\repo\\src\\app.js"]
  );
  assert.deepEqual(
    extractShellWritePaths("Add-Content -Path .\\src\\app.js -Value 'ok'"),
    [".\\src\\app.js"]
  );
});

test("archive gate hook uses leading cd directory as project root", async () => {
  const calls = [];
  const hook = createHarnessGateHook({
    directory: "/Users/demo/.config/opencode",
    verifierPath: "/Users/demo/.config/opencode/node_modules/pkg/bin/openspec-harness.mjs",
    nodePath: "/usr/bin/node",
    runner: (...args) => {
      calls.push(args);
      return { status: 0, stdout: "{\"ok\":true}", stderr: "" };
    }
  });

  await hook(
    { tool: "bash", sessionID: "s1", callID: "c1" },
    { args: { command: "cd /repo && openspec archive add-demo -y" } }
  );

  assert.deepEqual(calls[0][1], [
    "/Users/demo/.config/opencode/node_modules/pkg/bin/openspec-harness.mjs",
    "verify",
    "--mode",
    "archive",
    "--change",
    "add-demo",
    "--cwd",
    "/repo"
  ]);
});

test("archive gate hook detects shell-quoted openspec command", async () => {
  const calls = [];
  const hook = createHarnessGateHook({
    directory: "/repo",
    verifierPath: "/repo/bin/openspec-harness.mjs",
    runner: (...args) => {
      calls.push(args);
      return { status: 0, stdout: "{\"ok\":true}", stderr: "" };
    }
  });

  await hook(
    { tool: "bash", sessionID: "s1", callID: "c1" },
    { args: { command: "op\"enspec\" archive add-demo -y" } }
  );

  assert.equal(calls.length, 1);
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

test("implementation hook blocks cp into project before apply verification passes", async () => {
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
        { args: { command: "cp /tmp/app.js /repo/src/app.js" } }
      ),
    /blocked apply.*Business review is not approved/su
  );
});

test("implementation hook does not treat JavaScript comparison as shell redirect", async () => {
  const hook = createHarnessGateHook({
    directory: "/repo",
    runner: () => {
      throw new Error("runner should not be called");
    }
  });

  await hook(
    { tool: "bash", sessionID: "s1", callID: "c1" },
    { args: { command: "node -e \"if (arr[j] > arr[j + 1]) console.log('swap')\"" } }
  );
});

test("hook formats non-string verifier output without trim failures", async () => {
  const hook = createHarnessGateHook({
    directory: "/repo",
    verifierPath: "/repo/bin/openspec-harness.mjs",
    changeResolver: async () => "add-demo",
    runner: () => ({ status: 1, stdout: { failures: ["blocked"] }, stderr: null })
  });

  await assert.rejects(
    () =>
      hook(
        { tool: "write", sessionID: "s1", callID: "c1" },
        { args: { filePath: "src/app.js" } }
      ),
    /blocked apply/su
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

test("implementation hook handles Windows project paths", async () => {
  const hook = createHarnessGateHook({
    directory: "C:\\repo",
    verifierPath: "C:\\repo\\bin\\openspec-harness.mjs",
    changeResolver: async () => "add-demo",
    runner: () => ({ status: 1, stdout: "Business review is not approved", stderr: "" })
  });

  await assert.rejects(
    () =>
      hook(
        { tool: "powershell", sessionID: "s1", callID: "c1" },
        { args: { command: "Set-Content -Path C:\\repo\\src\\app.js -Value 'ok'" } }
      ),
    /blocked apply.*Business review is not approved/su
  );
});

test("implementation hook allows Windows OpenSpec artifact writes", async () => {
  const hook = createHarnessGateHook({
    directory: "C:\\repo",
    runner: () => {
      throw new Error("runner should not be called");
    }
  });

  await hook(
    { tool: "powershell", sessionID: "s1", callID: "c1" },
    { args: { command: "Set-Content -Path C:\\repo\\openspec\\changes\\add-demo\\tasks.md -Value 'ok'" } }
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
