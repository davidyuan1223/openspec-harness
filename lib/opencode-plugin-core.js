import { spawnSync } from "node:child_process";
import { isAbsolute, relative, resolve, win32 } from "node:path";

import { discoverChanges, inferState, inspectChange } from "./state-machine.js";

const ARCHIVE_RE = /\bopenspec\s+archive\b/u;
const CHANGE_RE = /\bopenspec\s+archive(?:\s+(?:--[^\s]+(?:\s+[^\s-][^\s]*)?))*\s+([a-z0-9][a-z0-9-]*)\b/u;

export function extractArchiveChange(command, fallback = process.env.OPENSPEC_CHANGE) {
  if (!ARCHIVE_RE.test(command)) {
    return null;
  }

  return CHANGE_RE.exec(command)?.[1] ?? fallback ?? null;
}

export function buildVerifyCommand({ verifierPath, change, cwd, mode = "archive" }) {
  return [
    verifierPath,
    "verify",
    "--mode",
    mode,
    "--change",
    change,
    "--cwd",
    cwd
  ];
}

function normalizePathSeparators(path) {
  return path.replace(/\\/gu, "/");
}

function isWindowsPath(path) {
  return /^[a-zA-Z]:[\\/]/u.test(path) || path.startsWith("\\\\");
}

function pathTools(path, projectRoot) {
  return isWindowsPath(path) || isWindowsPath(projectRoot)
    ? {
        isAbsolute: win32.isAbsolute,
        relative: win32.relative,
        resolve: win32.resolve
      }
    : { isAbsolute, relative, resolve };
}

function isNullDevicePath(path) {
  const normalized = normalizePathSeparators(path).toLowerCase();
  return normalized === "/dev/null" || normalized === "nul";
}

function isOpenSpecHarnessPath(path) {
  const normalized = normalizePathSeparators(path);
  return /(^|\/)openspec\/changes\//u.test(normalized) || /(^|\/)openspec\/harness\//u.test(normalized);
}

function isProjectWritePath(path, projectRoot) {
  if (!path || isNullDevicePath(path)) {
    return false;
  }

  const tools = pathTools(path, projectRoot);
  const resolved = tools.isAbsolute(path) ? path : tools.resolve(projectRoot, path);
  const rel = tools.relative(projectRoot, resolved);
  return rel !== "" && !rel.startsWith("..") && !tools.isAbsolute(rel);
}

function isImplementationPath(path, projectRoot) {
  if (!isProjectWritePath(path, projectRoot)) {
    return false;
  }

  const tools = pathTools(path, projectRoot);
  const rel = tools.relative(projectRoot, tools.isAbsolute(path) ? path : tools.resolve(projectRoot, path));
  return !isOpenSpecHarnessPath(rel);
}

export function extractShellWritePaths(command) {
  const paths = [];
  const patterns = [
    {
      regex: /(?:^|[\s;&|])(?:>|>>)\s*(['"]?)([^'"\s;&|]+)\1/gu,
      pathGroups: [2]
    },
    {
      regex: /\btee(?:\s+-a)?\s+(['"]?)([^'"\s;&|]+)\1/gu,
      pathGroups: [2]
    },
    {
      regex: /\b(?:Set-Content|Add-Content)\b[^\r\n]*?\s-Path\s+(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s\r\n]+))/giu,
      pathGroups: [1, 2, 3]
    }
  ];

  for (const pattern of patterns) {
    for (const match of command.matchAll(pattern.regex)) {
      const path = pattern.pathGroups.map((group) => match[group]).find(Boolean);
      if (path) paths.push(path);
    }
  }

  return paths;
}

function isImplementationWrite(input, output, projectRoot) {
  if (!["edit", "write"].includes(input?.tool)) {
    const command = output?.args?.command ?? "";
    if (!["bash", "shell", "powershell"].includes(input?.tool) || !command) {
      return false;
    }

    return extractShellWritePaths(command).some((path) => isImplementationPath(path, projectRoot));
  }

  const path = output?.args?.filePath ?? output?.args?.path ?? output?.args?.file ?? "";
  return isImplementationPath(path, projectRoot);
}

async function inferSingleActiveChange(cwd) {
  const changes = await discoverChanges(cwd);
  return changes.length === 1 ? changes[0] : null;
}

function runVerifier({ runner, nodePath, verifier, change, cwd, mode }) {
  return runner(
    nodePath,
    buildVerifyCommand({ verifierPath: verifier, change, cwd, mode }),
    { encoding: "utf8" }
  );
}

function formatHookFailure(change, mode, result) {
  const lines = [`OpenSpec Harness blocked ${mode} for ${change}.`];
  try {
    const parsed = JSON.parse(result.stdout?.trim() ?? "{}");
    if (parsed.failures?.length) {
      for (const f of parsed.failures) lines.push(`  - ${f}`);
    }
    if (!parsed.openspec?.ok) {
      lines.push(`  - openspec validate failed`);
    }
  } catch {
    if (result.stdout) lines.push(result.stdout.slice(0, 300));
  }
  if (result.stderr && !lines.some(l => l.includes(result.stderr))) {
    lines.push(result.stderr.slice(0, 200));
  }
  return lines.join("\n");
}

export function createHarnessGateHook({
  directory,
  worktree,
  verifierPath,
  runner = spawnSync,
  nodePath = "node",
  changeResolver = inferSingleActiveChange
} = {}) {
  const projectRoot = worktree ?? directory ?? process.cwd();
  const verifier = verifierPath ?? resolve(directory ?? process.cwd(), "bin", "openspec-harness.mjs");

  return async (input, output) => {
    const command = output?.args?.command ?? "";
    const change = extractArchiveChange(command);

    if (ARCHIVE_RE.test(command)) {
      if (!change) {
        throw new Error("OpenSpec Harness blocked archive: unable to determine change name");
      }

      const result = runVerifier({
        runner,
        nodePath,
        verifier,
        change,
        cwd: projectRoot,
        mode: "archive"
      });

      if (result.status !== 0) {
        throw new Error(formatHookFailure(change, "archive", result));
      }
      return;
    }

    if (!isImplementationWrite(input, output, projectRoot)) {
      return;
    }

    const activeChange = process.env.OPENSPEC_CHANGE ?? (await changeResolver(projectRoot));
    if (!activeChange) {
      throw new Error(
        "OpenSpec Harness blocked implementation edit: unable to determine a single active change"
      );
    }

    const result = runVerifier({
      runner,
      nodePath,
      verifier,
      change: activeChange,
      cwd: projectRoot,
      mode: "apply"
    });

    if (result.status !== 0) {
      throw new Error(formatHookFailure(activeChange, "apply", result));
    }
  };
}

export const createArchiveGateHook = createHarnessGateHook;

export async function buildSystemContext(cwd) {
  const changes = await discoverChanges(cwd);
  const summaries = [];

  for (const change of changes) {
    const state = await inspectChange(cwd, change);
    summaries.push({
      change,
      state: inferState(state),
      tasks: state.taskSummary,
      reviews: {
        business: `${state.reviews.business.status}/${state.reviews.business.valid ? "valid" : "invalid"}`,
        design: `${state.reviews.design.status}/${state.reviews.design.valid ? "valid" : "invalid"}`,
        test: `${state.reviews.test.status}/${state.reviews.test.valid ? "valid" : "invalid"}`,
        implementation: `${state.reviews.implementation.status}/${state.reviews.implementation.valid ? "valid" : "invalid"}`
      },
      constitution: state.constitution.present,
      testContext: state.testContext.present,
      testPlan: state.artifacts.test
    });
  }

  if (summaries.length === 0) {
    return "OpenSpec Harness: no active OpenSpec changes found.";
  }

  const lines = ["OpenSpec Harness active changes:"];
  for (const summary of summaries) {
    lines.push(
      `- ${summary.change}: state=${summary.state}, tasks=${summary.tasks.completed}/${summary.tasks.total}, missingEvidence=${summary.tasks.completedWithoutEvidence.length}, testContext=${summary.testContext}, testPlan=${summary.testPlan}, reviews=business:${summary.reviews.business},design:${summary.reviews.design},test:${summary.reviews.test},implementation:${summary.reviews.implementation}`
    );
  }
  lines.push("Use /openspec-harness:status or openspec_harness_status before changing phases.");

  return lines.join("\n");
}
