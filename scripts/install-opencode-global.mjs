#!/usr/bin/env node
import { installOpenSpecHarness } from "../lib/install.js";

const result = installOpenSpecHarness({
  localPack: true,
  packageSpec: process.env.OPENSPEC_HARNESS_PACKAGE_SPEC,
  configDir: process.env.OPENCODE_CONFIG_DIR,
  pluginMode: process.env.OPENSPEC_HARNESS_PLUGIN_MODE ?? "wrapper",
  commandMode: process.env.OPENSPEC_HARNESS_COMMAND_MODE ?? "files",
  pruneConfigCommands: process.env.OPENSPEC_HARNESS_PRUNE_CONFIG_COMMANDS === "1"
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(result.ok ? 0 : 1);
