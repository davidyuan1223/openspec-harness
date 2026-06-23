import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

import { syncContext, syncDocs } from "./context-sync.js";
import { doctorOpenSpecHarness, installOpenSpecHarness } from "./install.js";
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

function printInstallResult(result) {
  process.stdout.write(`OpenSpec Harness install: ${result.ok ? "ok" : "failed"}\n`);
  process.stdout.write(`package: ${result.packageName}@${result.version}\n`);
  process.stdout.write(`config: ${result.configFile ?? result.configDir}\n`);
  process.stdout.write(`package spec: ${result.packageSpec}\n`);
  if (result.pluginWrapper) process.stdout.write(`plugin wrapper: ${result.pluginWrapper}\n`);
  if (result.commandDir) process.stdout.write(`commands: ${result.commandDir} (${result.commandMode}, ${result.commandFileCount ?? 0} files)\n`);
  if (result.skillsDir) process.stdout.write(`skills: ${result.skillsDir}\n`);
  if (result.tarball) process.stdout.write(`local tarball: ${result.tarball}\n`);
  if (result.npm?.stderr) process.stdout.write(`npm stderr:\n${result.npm.stderr}\n`);
  if (result.error) process.stdout.write(`error: ${result.error}\n`);
  if (result.ok && result.opencode && !result.opencode.ok) {
    process.stdout.write(`warning: ${result.opencode.error}\n`);
  }
}

function printDoctorResult(result) {
  process.stdout.write(`OpenSpec Harness doctor: ${result.ok ? "ok" : "failed"}\n`);
  process.stdout.write(`package: ${result.packageName}@${result.version}\n`);
  process.stdout.write(`config: ${result.configFile}\n`);
  process.stdout.write(`plugin registered: ${result.pluginRegistered ? "yes" : "no"}\n`);
  process.stdout.write(`dependency installed: ${result.dependencyInstalled ? "yes" : "no"}\n`);
  process.stdout.write(`skills present: ${result.skillsPresent ? "yes" : "no"}\n`);
  process.stdout.write(`command files: ${result.commandFilesPresent ? "yes" : "no"} (${result.commandFileCount})\n`);
  process.stdout.write(`config commands: ${result.configCommandCount}\n`);
  process.stdout.write(`opencode: ${result.opencode.ok ? result.opencode.version : "not found"}\n`);
  if (result.findings.length) {
    process.stdout.write("Findings:\n");
    for (const finding of result.findings) {
      process.stdout.write(`- ${finding.severity}: ${finding.message}\n`);
    }
  }
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

  if (command === "context-sync") {
    const feedback = args.feedback ?? args._.slice(1).join(" ");
    const result = await syncContext(cwd, {
      feedback,
      change: args.change ?? null,
      write: Boolean(args.write)
    });

    if (json) {
      printJson({ cwd, ...result });
      return 0;
    }

    process.stdout.write(`OpenSpec Harness context sync: ${result.classification.action}\n`);
    process.stdout.write(`level: ${result.classification.level}\n`);
    process.stdout.write(`reason: ${result.classification.reason}\n`);
    process.stdout.write(`context: ${result.contextPresent ? "present" : "missing"} (${result.contextPath})\n`);
    if (result.write) process.stdout.write("updated: context.md and decision-log.md\n");
    process.stdout.write("Recommended impact:\n");
    for (const impact of result.recommendedImpacts) {
      process.stdout.write(`- ${impact}\n`);
    }
    return 0;
  }

  if (command === "docs-sync") {
    const result = await syncDocs(cwd);

    if (json) {
      printJson({ cwd, ...result });
      return result.ok ? 0 : 1;
    }

    process.stdout.write(`OpenSpec Harness docs sync: ${result.ok ? "ok" : "failed"}\n`);
    process.stdout.write(`package: ${result.packageName}@${result.version}\n`);
    process.stdout.write(`commands: ${result.commands.length}, skills: ${result.skills.length}\n`);
    if (result.findings.length) {
      process.stdout.write("Findings:\n");
      for (const finding of result.findings) {
        process.stdout.write(`- ${finding.severity}/${finding.area}: ${finding.message}\n`);
      }
    }
    return result.ok ? 0 : 1;
  }

  if (command === "install") {
    const result = installOpenSpecHarness({
      configDir: args["config-dir"],
      packageSpec: args["package-spec"],
      pluginMode: args["plugin-mode"] ?? "wrapper",
      commandMode: args["command-mode"] ?? "files",
      npmInstall: !args["no-npm-install"],
      syncCommands: !args["no-sync-commands"],
      syncSkills: !args["no-sync-skills"],
      pruneConfigCommands: Boolean(args["prune-config-commands"]),
      localPack: Boolean(args["local-pack"])
    });

    if (json) {
      printJson(result);
      return result.ok ? 0 : 1;
    }

    printInstallResult(result);
    return result.ok ? 0 : 1;
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
    if (args.global || args.install) {
      const result = doctorOpenSpecHarness({ configDir: args["config-dir"] });
      if (json) {
        printJson(result);
        return result.ok ? 0 : 1;
      }
      printDoctorResult(result);
      return result.ok ? 0 : 1;
    }

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
