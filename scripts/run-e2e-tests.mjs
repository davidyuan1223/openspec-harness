import { spawnSync } from "node:child_process";

const nodeCommand = process.execPath;
const result = spawnSync(nodeCommand, ["--test", "test/e2e/*.test.mjs"], {
  env: {
    ...process.env,
    OPENSPEC_HARNESS_E2E: "1"
  },
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);
