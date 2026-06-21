import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

import { executeLoopStep, recommendNextAction } from "./loop.js";
import { discoverChanges, inferState, inspectChange, verifyTransition } from "./state-machine.js";
import {
  formatTestSopFailures,
  planTestSop,
  scanTestSop,
  verifyTestEvidence
} from "./test-context-verifier.js";

function parseArgs(argv) {
  const args = {
    _: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function runOpenSpecValidate(cwd) {
  return spawnSync("openspec", ["validate", "--all", "--strict", "--no-interactive"], {
    cwd,
    encoding: "utf8"
  });
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const command = args._[0] ?? "status";
  const cwd = resolve(args.cwd ?? process.cwd());
  const change = args.change ?? args._[1];
  const json = Boolean(args.json);

  if (command === "status") {
    const changes = await discoverChanges(cwd);
    const inspected = [];

    for (const item of changes) {
      const state = await inspectChange(cwd, item);
      inspected.push({
        ...state,
        state: inferState(state)
      });
    }

    if (json) {
      printJson({ cwd, changes: inspected });
      return 0;
    }

    if (inspected.length === 0) {
      process.stdout.write("No OpenSpec changes found.\n");
      return 0;
    }

    for (const item of inspected) {
      process.stdout.write(`${item.change}: ${item.state}\n`);
    }

    return 0;
  }

  if (command === "verify") {
    if (!change) {
      throw new Error("Missing change. Use --change <id> or openspec-harness verify <id>.");
    }

    const target = args.target ?? args.mode ?? "archive";
    const state = await inspectChange(cwd, change);
    const transition = verifyTransition(state, target);
    const testEvidence = target === "archive"
      ? await verifyTestEvidence(cwd, change, { disabled: Boolean(args["no-test-evidence"]) })
      : null;
    const openspecResult = runOpenSpecValidate(cwd);
    const openspecOk = openspecResult.status === 0;
    const result = {
      cwd,
      change,
      state: inferState(state),
      target,
      ok: transition.ok && openspecOk && (testEvidence?.ok ?? true),
      failures: [...transition.failures, ...formatTestSopFailures(testEvidence)],
      testEvidence,
      openspec: {
        ok: openspecOk,
        stdout: openspecResult.stdout,
        stderr: openspecResult.stderr
      }
    };

    if (!openspecOk) {
      result.failures.push("openspec validate --all --strict failed");
    }

    if (json) {
      printJson(result);
      return result.ok ? 0 : 1;
    }

    if (result.ok) {
      process.stdout.write(`OpenSpec Harness passed for ${change}.\n`);
      return 0;
    }

    process.stdout.write(`OpenSpec Harness failed for ${change}:\n`);
    for (const failure of result.failures) {
      process.stdout.write(`- ${failure}\n`);
    }
    return 1;
  }

  if (command === "scan-test-context") {
    const sop = await scanTestSop(cwd, { write: Boolean(args.write) });
    if (json) {
      printJson({ cwd, sop });
      return 0;
    }

    process.stdout.write(`OpenSpec Harness test context: ${sop.projectType}\n`);
    process.stdout.write(`status: ${sop.status ?? "draft"}\n`);
    for (const surface of sop.surfaces) {
      process.stdout.write(`- ${surface.id}: ${surface.confidence} (${surface.checks.length} checks)\n`);
    }
    if (sop.questions?.length) {
      process.stdout.write("Questions:\n");
      for (const question of sop.questions) {
        process.stdout.write(`- ${question.id}: ${question.question}\n`);
      }
    }
    return 0;
  }

  if (command === "plan-change-tests") {
    if (!change) {
      throw new Error("Missing change. Use --change <id> or openspec-harness plan-change-tests <id>.");
    }

    const plan = await planTestSop(cwd, change);
    if (json) {
      printJson({ cwd, plan });
      return 0;
    }

    process.stdout.write(`${change}: ${plan.required.length} test check(s) required\n`);
    if (plan.sopQuestions?.length) {
      process.stdout.write("Test context questions:\n");
      for (const question of plan.sopQuestions) {
        process.stdout.write(`- ${question.id}: ${question.question}\n`);
      }
    }
    for (const check of plan.required) {
      process.stdout.write(`- ${check.id}: ${check.reason}\n`);
    }
    if (plan.taskTests?.length) {
      process.stdout.write("Task test cases:\n");
      for (const taskTest of plan.taskTests) {
        process.stdout.write(`- ${taskTest.id}: ${taskTest.assertion}\n`);
      }
    }
    return 0;
  }

  if (command === "verify-test-evidence") {
    if (!change) {
      throw new Error("Missing change. Use --change <id> or openspec-harness verify-test-evidence <id>.");
    }

    const result = await verifyTestEvidence(cwd, change, { disabled: Boolean(args["no-test-evidence"]) });
    if (json) {
      printJson({ cwd, ...result });
      return result.ok ? 0 : 1;
    }

    if (result.ok) {
      process.stdout.write(`OpenSpec Harness test evidence passed for ${change}.\n`);
      if (result.disabled) {
        process.stdout.write("Warning: test evidence verification disabled by --no-test-evidence.\n");
      }
      return 0;
    }

    process.stdout.write(`OpenSpec Harness test evidence failed for ${change}:\n`);
    for (const failure of result.failures) {
      process.stdout.write(`- ${failure}\n`);
    }
    for (const warning of result.warnings) {
      process.stdout.write(`Warning: ${warning}\n`);
    }
    return 1;
  }

  if (command === "loop") {
    const changes = change ? [change] : await discoverChanges(cwd);
    if (changes.length !== 1) {
      throw new Error("Loop requires exactly one change. Use --change <id>.");
    }

    const state = await inspectChange(cwd, changes[0]);
    const recommendation = recommendNextAction(state);
    const execution = args.execute
      ? executeLoopStep({
          change: changes[0],
          cwd,
          recommendation,
          runner: spawnSync,
          allowArchive: Boolean(args["allow-archive"])
        })
      : null;
    const result = {
      cwd,
      change: changes[0],
      ...recommendation,
      execution
    };

    if (json) {
      printJson(result);
      return recommendation.blocked || execution?.ok === false ? 1 : 0;
    }

    process.stdout.write(`${changes[0]}: ${recommendation.state} -> ${recommendation.action}\n`);
    process.stdout.write(`Next: ${recommendation.command.replace("<change>", changes[0])}\n`);
    if (execution) {
      process.stdout.write(`Executed: ${execution.executed ? "yes" : "no"} (${execution.reason})\n`);
    }
    if (recommendation.reasons.length > 0) {
      process.stdout.write("Reasons:\n");
      for (const reason of recommendation.reasons) {
        process.stdout.write(`- ${reason}\n`);
      }
    }
    return recommendation.blocked || execution?.ok === false ? 1 : 0;
  }

  if (command === "doctor") {
    const checks = {
      cwd,
      opencodeConfig: join(cwd, "opencode.json"),
      commandsNamespace: "openspec-harness:*",
      pluginPath: join(cwd, ".opencode", "plugins", "openspec-harness.ts")
    };

    if (json) {
      printJson(checks);
      return 0;
    }

    process.stdout.write(`OpenSpec Harness doctor\ncwd: ${cwd}\n`);
    process.stdout.write(`config: ${checks.opencodeConfig}\n`);
    process.stdout.write(`plugin: ${checks.pluginPath}\n`);
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}
