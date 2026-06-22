import { tool } from "@opencode-ai/plugin";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { syncContext, syncDocs } from "./context-sync.js";
import { recommendNextAction } from "./loop.js";
import {
  buildSystemContext,
  createHarnessGateHook
} from "./opencode-plugin-core.js";
import { discoverChanges, inferState, inspectChange, verifyTransition } from "./state-machine.js";
import {
  formatTestSopFailures,
  planTestSop,
  scanTestSop,
  verifyTestEvidence
} from "./test-context-verifier.js";

function runOpenSpecValidate(cwd) {
  const result = spawnSync("openspec", ["validate", "--all", "--strict", "--no-interactive"], {
    cwd,
    encoding: "utf8"
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function formatVerifyOutput(json) {
  if (!json) return "";
  const lines = [`${json.change ?? "?"}: ${json.target ?? "archive"} gate ${json.ok ? "PASSED" : "FAILED"} (state: ${json.state ?? "?"})`];
  if (json.failures?.length) {
    for (const f of json.failures) lines.push(`  - ${f}`);
  }
  lines.push(`openspec validate: ${json.openspec?.ok ? "PASSED" : "FAILED"}`);
  return lines.join("\n");
}

function formatStatusOutput(json) {
  if (!json) return "";
  const lines = [];
  for (const c of json.changes ?? []) {
    const tasks = c.taskSummary ?? c.tasks ?? {};
    const testContext = c.testContext?.present ? "test-context:yes" : "test-context:no";
    const testPlan = c.artifacts?.test ? "test:yes" : "test:no";
    const testReview = c.reviews?.test
      ? `test-review:${c.reviews.test.status}/${c.reviews.test.valid ? "valid" : "invalid"}`
      : "test-review:?";
    lines.push(`${c.change}: ${c.state} (tasks ${tasks.completed ?? "?"}/${tasks.total ?? "?"}, ${testContext}, ${testPlan}, ${testReview})`);
  }
  return lines.length ? lines.join("\n") : "no active changes";
}

function formatLoopOutput(json) {
  if (!json) return "";
  const lines = [`${json.change ?? "?"}: ${json.action ?? "?"} (blocked: ${json.blocked})`];
  if (json.command) lines.push(`Command: ${json.command}`);
  if (json.reasons?.length) {
    for (const r of json.reasons) lines.push(`  - ${r}`);
  }
  return lines.join("\n");
}

function formatScanTestsOutput(json) {
  const sop = json?.sop;
  if (!sop) return "";
  const lines = [`projectType=${sop.projectType}`, `status=${sop.status ?? "draft"}`];
  for (const surface of sop.surfaces ?? []) {
    lines.push(`${surface.id}: ${surface.confidence}, checks=${surface.checks?.length ?? 0}`);
  }
  for (const question of sop.questions ?? []) {
    lines.push(`? ${question.id}: ${question.question}`);
  }
  return lines.join("\n");
}

function formatPlanTestsOutput(json) {
  const plan = json?.plan;
  if (!plan) return "";
  const lines = [`${plan.change}: ${plan.required?.length ?? 0} required test check(s)`];
  if (plan.sopQuestions?.length) {
    for (const question of plan.sopQuestions) {
      lines.push(`? ${question.id}: ${question.question}`);
    }
  }
  for (const check of plan.required ?? []) {
    lines.push(`  - ${check.id}: ${check.reason}`);
  }
  for (const taskTest of plan.taskTests ?? []) {
    lines.push(`  test ${taskTest.id}: ${taskTest.assertion}`);
  }
  return lines.join("\n");
}

function formatVerifyTestsOutput(json) {
  if (!json) return "";
  const lines = [`${json.change ?? "?"}: test evidence ${json.ok ? "PASSED" : "FAILED"}`];
  for (const failure of json.failures ?? []) {
    lines.push(`  - ${failure}`);
  }
  for (const warning of json.warnings ?? []) {
    lines.push(`  ! ${warning}`);
  }
  return lines.join("\n");
}

function formatContextSyncOutput(json) {
  if (!json) return "";
  const lines = [
    `action=${json.classification?.action ?? "?"}`,
    `level=${json.classification?.level ?? "?"}`,
    `reason=${json.classification?.reason ?? "?"}`
  ];
  for (const impact of json.recommendedImpacts ?? []) {
    lines.push(`- ${impact}`);
  }
  if (json.write) lines.push("updated=context.md,decision-log.md");
  return lines.join("\n");
}

function formatDocsSyncOutput(json) {
  if (!json) return "";
  const lines = [`docs-sync ${json.ok ? "PASSED" : "FAILED"}`, `commands=${json.commands?.length ?? 0}, skills=${json.skills?.length ?? 0}`];
  for (const finding of json.findings ?? []) {
    lines.push(`- ${finding.severity}/${finding.area}: ${finding.message}`);
  }
  return lines.join("\n");
}

const MAX_OUTPUT = 800;

const defaultPackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function createOpenSpecHarnessPlugin({ packageRoot = defaultPackageRoot } = {}) {
  return async ({ directory, worktree }) => {
    const cwd = worktree ?? directory;
    const verifierPath = resolve(packageRoot, "bin", "openspec-harness.mjs");
    const enableSystemContext = process.env.OPENSPEC_HARNESS_SYSTEM_CONTEXT === "1";

    const plugin = {
      "tool.execute.before": createHarnessGateHook({
        directory,
        worktree,
        verifierPath
      }),

      tool: {
        openspec_harness_status: tool({
          description: "Inspect OpenSpec Harness state for the current project.",
          args: {},
          async execute() {
            const changes = await discoverChanges(cwd);
            const inspected = [];
            for (const change of changes) {
              const state = await inspectChange(cwd, change);
              inspected.push({
                ...state,
                state: inferState(state)
              });
            }

            return {
              title: "OpenSpec Harness status",
              output: formatStatusOutput({ changes: inspected }).slice(0, MAX_OUTPUT),
              metadata: { exitCode: 0 }
            };
          }
        }),

        openspec_harness_verify: tool({
          description: "Verify an OpenSpec change against OpenSpec Harness gates.",
          args: {
            change: tool.schema.string().describe("OpenSpec change id"),
            mode: tool.schema.enum(["apply", "archive"]).default("archive")
          },
          async execute(args) {
            const state = await inspectChange(cwd, args.change);
            const transition = verifyTransition(state, args.mode);
            const testEvidence = args.mode === "archive"
              ? await verifyTestEvidence(cwd, args.change)
              : null;
            const openspec = runOpenSpecValidate(cwd);
            const failures = [...transition.failures, ...formatTestSopFailures(testEvidence)];
            if (!openspec.ok) {
              failures.push("openspec validate --all --strict failed");
            }
            const result = {
              change: args.change,
              state: inferState(state),
              target: args.mode,
              ok: transition.ok && openspec.ok && (testEvidence?.ok ?? true),
              failures,
              testEvidence,
              openspec
            };

            return {
              title: result.ok ? "OpenSpec Harness passed" : "OpenSpec Harness failed",
              output: formatVerifyOutput(result).slice(0, MAX_OUTPUT),
              metadata: {
                exitCode: result.ok ? 0 : 1,
                change: args.change,
                mode: args.mode
              }
            };
          }
        }),

        openspec_harness_loop: tool({
          description: "Recommend or execute one safe OpenSpec Harness loop step for a change.",
          args: {
            change: tool.schema.string().describe("OpenSpec change id"),
            execute: tool.schema.boolean().default(false).describe("Execute mechanical loop actions"),
            allowArchive: tool.schema.boolean().default(false).describe("Allow archive execution when gates pass")
          },
          async execute(args) {
            const state = await inspectChange(cwd, args.change);
            const recommendation = recommendNextAction(state);
            const result = {
              change: args.change,
              ...recommendation,
              execution: args.execute
                ? {
                    executed: false,
                    action: recommendation.action,
                    ok: false,
                    reason: "OpenCode plugin tool does not execute CLI archive commands; use the archive command after gates pass"
                  }
                : null
            };

            return {
              title: result.blocked ? "OpenSpec Harness blocked" : "OpenSpec Harness next action",
              output: formatLoopOutput(result).slice(0, MAX_OUTPUT),
              metadata: {
                exitCode: result.blocked ? 1 : 0,
                change: args.change
              }
            };
          }
        }),

        openspec_harness_scan_test_context: tool({
          description: "Scan the current project and summarize test-context signals for the agent.",
          args: {},
          async execute() {
            const sop = await scanTestSop(cwd);

            return {
              title: "OpenSpec Harness test context",
              output: formatScanTestsOutput({ sop }).slice(0, MAX_OUTPUT),
              metadata: {
                exitCode: 0
              }
            };
          }
        }),

        openspec_harness_plan_change_tests: tool({
          description: "Plan required checks for an OpenSpec change from test-context signals.",
          args: {
            change: tool.schema.string().describe("OpenSpec change id")
          },
          async execute(args) {
            const plan = await planTestSop(cwd, args.change);

            return {
              title: "OpenSpec Harness change test plan",
              output: formatPlanTestsOutput({ plan }).slice(0, MAX_OUTPUT),
              metadata: {
                exitCode: 0,
                change: args.change
              }
            };
          }
        }),

        openspec_harness_verify_test_evidence: tool({
          description: "Verify behavior evidence for an OpenSpec change test plan.",
          args: {
            change: tool.schema.string().describe("OpenSpec change id")
          },
          async execute(args) {
            const result = await verifyTestEvidence(cwd, args.change);

            return {
              title: result.ok ? "OpenSpec Harness test evidence passed" : "OpenSpec Harness test evidence failed",
              output: formatVerifyTestsOutput(result).slice(0, MAX_OUTPUT),
              metadata: {
                exitCode: result.ok ? 0 : 1,
                change: args.change
              }
            };
          }
        }),

        openspec_harness_context_sync: tool({
          description: "Analyze user feedback for context drift and optionally update project context documents.",
          args: {
            feedback: tool.schema.string().describe("Latest user feedback or correction to align against"),
            change: tool.schema.string().optional().describe("OpenSpec change id affected by the feedback"),
            write: tool.schema.boolean().default(false).describe("Write context.md and decision-log.md updates")
          },
          async execute(args) {
            const result = await syncContext(cwd, args);

            return {
              title: "OpenSpec Harness context sync",
              output: formatContextSyncOutput(result).slice(0, MAX_OUTPUT),
              metadata: {
                exitCode: 0,
                action: result.classification.action,
                level: result.classification.level,
                write: result.write
              }
            };
          }
        }),

        openspec_harness_docs_sync: tool({
          description: "Check that context-level docs, skills, commands, and implementation surfaces are aligned.",
          args: {},
          async execute() {
            const result = await syncDocs(cwd);

            return {
              title: result.ok ? "OpenSpec Harness docs sync passed" : "OpenSpec Harness docs sync failed",
              output: formatDocsSyncOutput(result).slice(0, MAX_OUTPUT),
              metadata: {
                exitCode: result.ok ? 0 : 1,
                findings: result.findings.length
              }
            };
          }
        })
      }
    };

    if (enableSystemContext) {
      plugin["experimental.chat.system.transform"] = async (_input, output) => {
        output.system.push(await buildSystemContext(cwd));
      };
    }

    return plugin;
  };
}

export const OpenSpecHarnessPlugin = createOpenSpecHarnessPlugin();
export const server = OpenSpecHarnessPlugin;
