import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createOpencodeClient } from "@opencode-ai/sdk";

const cwd = process.cwd();
const port = Number(process.env.OPENSPEC_HARNESS_OPENCODE_PORT ?? 4197);
const timeoutMs = Number(process.env.OPENSPEC_HARNESS_OPENCODE_TIMEOUT_MS ?? 15000);

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for opencode serve on port ${port}`));
    }, timeoutMs);

    const onData = (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      const match = /opencode server listening on (?<url>http:\/\/[^\s]+)/u.exec(text);
      if (match?.groups?.url) {
        clearTimeout(timer);
        resolve(match.groups.url);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`opencode serve exited before listening: ${code}`));
    });
  });
}

const child = spawn(
  "opencode",
  ["serve", "--hostname", "127.0.0.1", "--port", String(port), "--print-logs"],
  {
    cwd,
    stdio: ["ignore", "pipe", "pipe"]
  }
);

try {
  const baseUrl = await waitForServer(child);
  const client = createOpencodeClient({ baseUrl });

  const project = await client.project.current();
  const path = await client.path.get();
  const config = await client.config.get();
  const commandList = await client.command.list({});
  const toolIds = await client.tool.ids({});
  assert(config.data, `config.get failed: ${JSON.stringify(config)}`);
  const commands = Object.keys(config.data.command ?? {});
  const commandNames = (commandList.data ?? []).map((command) => command.name);

  assert.equal(project.data.worktree, cwd);
  assert.equal(path.data.directory, cwd);
  assert(commands.includes("openspec-harness:explore"));
  assert(commands.includes("openspec-harness:archive"));
  assert(commandNames.includes("openspec-harness:verify"));
  assert(commandNames.includes("openspec-harness:loop"));
  assert(toolIds.data.includes("openspec_harness_status"));
  assert(toolIds.data.includes("openspec_harness_verify"));
  assert(toolIds.data.includes("openspec_harness_loop"));

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        worktree: project.data.worktree,
        commands: commands.filter((command) => command.startsWith("openspec-harness:")),
        tools: toolIds.data.filter((toolId) => toolId.startsWith("openspec_harness_"))
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
} finally {
  child.kill("SIGINT");
}
