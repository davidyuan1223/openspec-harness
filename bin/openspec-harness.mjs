#!/usr/bin/env node
import { runCli } from "../lib/cli.js";

try {
  const code = await runCli();
  process.exitCode = code;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
