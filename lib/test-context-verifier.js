import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { pathExists, readTextIfExists } from "./fs-utils.js";

const TEST_CONTEXT_SCHEMA_VERSION = 1;

const FRONTEND_CONFIGS = [
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "next.config.js",
  "next.config.mjs",
  "nuxt.config.js",
  "nuxt.config.ts"
];

const FRONTEND_DEPS = ["vite", "react", "vue", "svelte", "next", "nuxt"];
const BACKEND_DEPS = ["express", "fastify", "hono", "koa", "@nestjs/core"];
const INTERACTION_TERMS = [
  "visualizer",
  "visualiser",
  "svg",
  "canvas",
  "graph",
  "tree",
  "chart",
  "playback",
  "click",
  "select",
  "modal",
  "sidebar",
  "form",
  "route",
  "page",
  "layout",
  "component"
];
const WEAK_FRONTEND_COMMANDS = [
  /\bcurl\b.*localhost/iu,
  /\bwget\b.*localhost/iu,
  /\bvite\s+build\b/iu,
  /\bnpm\s+run\s+build\b/iu,
  /\bnpm\s+run\s+typecheck\b/iu,
  /\bnpm\s+run\s+lint\b/iu,
  /\bserved app locally\b/iu,
  /\brefresh(?:ed)? localhost\b/iu,
  /\bmanual browser check\b/iu
];

export function parseTaskTestCases(content) {
  if (!content) return [];
  const cases = [];
  let currentTask = null;

  for (const line of content.split(/\r?\n/u)) {
    const taskMatch = /^-\s+\[[ xX]\]\s+(?<label>.+)$/u.exec(line.trim());
    if (taskMatch?.groups?.label) {
      currentTask = taskMatch.groups.label.trim();
      continue;
    }

    const testMatch = /^\s*-\s+Test(?:\s+Case)?:\s*(?<text>.+)$/iu.exec(line);
    if (testMatch?.groups?.text) {
      cases.push({
        id: `task-test-${cases.length + 1}`,
        task: currentTask,
        assertion: testMatch.groups.text.trim()
      });
    }
  }

  return cases;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

async function readJsonIfExists(path) {
  const text = await readTextIfExists(path);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function hasTestContext(cwd) {
  const text = await readTextIfExists(join(cwd, "openspec", "harness", "test-context.md"));
  return Boolean(text?.trim());
}

async function listFiles(root, maxDepth = 2, prefix = "") {
  if (maxDepth < 0 || !(await pathExists(root))) return [];
  const entries = await readdir(root);
  const files = [];

  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    const fullPath = join(root, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      files.push(...await listFiles(fullPath, maxDepth - 1, rel));
    } else {
      files.push(rel);
    }
  }

  return files;
}

function packageDependencies(pkg) {
  return {
    ...pkg?.dependencies,
    ...pkg?.devDependencies,
    ...pkg?.peerDependencies
  };
}

function hasAnyDependency(pkg, names) {
  const deps = packageDependencies(pkg);
  return names.some((name) => Object.hasOwn(deps, name));
}

function scriptCommand(pkg, candidates) {
  const scripts = pkg?.scripts ?? {};
  for (const name of candidates) {
    if (scripts[name]) return `npm run ${name}`;
  }
  return null;
}

function addCheck(checks, check) {
  if (!checks.some((item) => item.id === check.id)) {
    checks.push(check);
  }
}

export async function scanTestSop(cwd, { write = false } = {}) {
  const testContextPresent = await hasTestContext(cwd);
  const pkg = await readJsonIfExists(join(cwd, "package.json"));
  const files = await listFiles(cwd, 2);
  const scripts = pkg?.scripts ?? {};
  const surfaces = [];
  const questions = [];

  const hasFrontendConfig = FRONTEND_CONFIGS.some((file) => files.includes(file));
  const hasFrontend = hasFrontendConfig || hasAnyDependency(pkg, FRONTEND_DEPS) || Boolean(scripts.dev);
  const hasBackend = hasAnyDependency(pkg, BACKEND_DEPS) || Boolean(scripts.start) || files.some((file) => /(^|\/)(server|app|main)\.[cm]?[jt]s$/u.test(file));
  const hasCli = Boolean(pkg?.bin) || files.some((file) => file.startsWith("bin/"));

  if (hasFrontend) {
    const checks = [];
    const typecheck = scriptCommand(pkg, ["typecheck", "check"]);
    const build = scriptCommand(pkg, ["build"]);
    const dev = scriptCommand(pkg, ["dev", "start"]);
    const e2e = scriptCommand(pkg, ["test:e2e", "e2e", "test:playwright", "playwright"]);

    if (typecheck) addCheck(checks, { id: "frontend.typecheck", surface: "frontend", level: "static", command: typecheck });
    if (build) addCheck(checks, { id: "frontend.build", surface: "frontend", level: "build", command: build });
    if (dev) addCheck(checks, { id: "frontend.runtime", surface: "frontend", level: "runtime", command: dev, probe: "localhost" });
    addCheck(checks, {
      id: "frontend.interaction.visualizer",
      surface: "frontend",
      level: "interaction",
      command: e2e ?? "project-specific browser/component test",
      requiresStructuredEvidence: true
    });
    if (!e2e) {
      questions.push({
        id: "frontend.interaction.command",
        question: "Which command verifies frontend user interactions or component behavior?",
        reason: "Frontend signals were detected, but no e2e/component test script was found."
      });
    }

    surfaces.push({
      id: "frontend",
      kind: "frontend",
      confidence: hasFrontendConfig || hasAnyDependency(pkg, FRONTEND_DEPS) ? "high" : "medium",
      signals: unique([
        hasFrontendConfig ? "frontend config" : null,
        hasAnyDependency(pkg, FRONTEND_DEPS) ? "frontend dependencies" : null,
        scripts.dev ? "package.json:scripts.dev" : null
      ]),
      checks
    });
  }

  if (hasBackend) {
    const checks = [];
    const test = scriptCommand(pkg, ["test", "test:integration"]);
    const start = scriptCommand(pkg, ["start", "dev"]);
    if (test) addCheck(checks, { id: "backend.test", surface: "backend", level: "static", command: test });
    if (start) addCheck(checks, { id: "backend.runtime", surface: "backend", level: "runtime", command: start, requiresStructuredEvidence: true });
    if (!start) {
      questions.push({
        id: "backend.runtime.command",
        question: "Which command starts the backend or test server for runtime verification?",
        reason: "Backend signals were detected, but no start/dev script was found."
      });
    }
    surfaces.push({
      id: "backend",
      kind: "backend",
      confidence: hasAnyDependency(pkg, BACKEND_DEPS) ? "high" : "medium",
      signals: unique([
        hasAnyDependency(pkg, BACKEND_DEPS) ? "backend dependencies" : null,
        scripts.start ? "package.json:scripts.start" : null
      ]),
      checks
    });
  }

  if (hasCli) {
    const checks = [];
    const test = scriptCommand(pkg, ["test"]);
    if (test) addCheck(checks, { id: "cli.test", surface: "cli", level: "static", command: test });
    addCheck(checks, { id: "cli.invocation", surface: "cli", level: "runtime", command: "invoke changed CLI command", requiresStructuredEvidence: true });
    surfaces.push({
      id: "cli",
      kind: "cli",
      confidence: "high",
      signals: unique([pkg?.bin ? "package.json:bin" : null, files.some((file) => file.startsWith("bin/")) ? "bin/" : null]),
      checks
    });
  }

  const projectType =
    hasFrontend && hasBackend ? "fullstack" :
    hasFrontend ? "frontend" :
    hasBackend ? "backend" :
    hasCli ? "cli" :
    pkg ? "library" : "unknown";

  const sop = {
    version: TEST_CONTEXT_SCHEMA_VERSION,
    status: testContextPresent ? "documented" : "draft",
    source: testContextPresent ? "test-context" : "scanner",
    projectType,
    packageManagers: pkg ? ["npm"] : [],
    surfaces,
    questions: testContextPresent ? [] : questions,
    evidenceRules: []
  };

  if (write) {
    await mkdir(join(cwd, "openspec", "harness"), { recursive: true });
    await writeFile(join(cwd, "openspec", "harness", "test-context.md"), renderTestContextDraft(sop));
  }

  return sop;
}

function renderTestContextDraft(context) {
  const lines = [
    "# Test Context",
    "",
    "## Project Type",
    context.projectType,
    "",
    "## Detected Surfaces"
  ];

  for (const surface of context.surfaces ?? []) {
    lines.push("", `### ${surface.id}`, "", `Confidence: ${surface.confidence}`);
    for (const check of surface.checks ?? []) {
      lines.push(`- ${check.id}: ${check.command ?? "project-specific check"}`);
    }
  }

  if (context.questions?.length) {
    lines.push("", "## Questions To Confirm");
    for (const question of context.questions) {
      lines.push(`- ${question.id}: ${question.question}`);
    }
  }

  lines.push(
    "",
    "## Verification Notes",
    "Describe how to start the app, seed data, authenticate, reset state, and collect credible evidence for frontend, backend, and CLI surfaces.",
    ""
  );

  return `${lines.join("\n")}`;
}

function parseChangedPathsBlock(text) {
  if (!text) return [];
  const match = /^##\s+Changed Paths\s*$\n(?<body>[\s\S]*?)(?=^##\s+|$(?![\s\S]))/imu.exec(text);
  if (!match?.groups?.body) return [];
  return match.groups.body
    .split(/\r?\n/u)
    .map((line) => /^-\s+(?<path>\S.*)$/u.exec(line.trim())?.groups?.path?.trim())
    .filter(Boolean);
}

function gitChangedPaths(cwd) {
  const diff = spawnSync("git", ["diff", "--name-only", "HEAD", "--"], { cwd, encoding: "utf8" });
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd, encoding: "utf8" });
  if (diff.status !== 0 && untracked.status !== 0) {
    return null;
  }
  return unique([
    ...(diff.stdout ?? "").split(/\r?\n/u),
    ...(untracked.stdout ?? "").split(/\r?\n/u)
  ].map((item) => item.trim()));
}

async function readChangeText(cwd, change) {
  const root = join(cwd, "openspec", "changes", change);
  const names = ["proposal.md", "design.md", "tasks.md", "evidence.md", "verification.md"];
  const texts = [];
  for (const name of names) {
    texts.push(await readTextIfExists(join(root, name)) ?? "");
  }
  return texts.join("\n");
}

async function readChangeTasks(cwd, change) {
  return readTextIfExists(join(cwd, "openspec", "changes", change, "tasks.md"));
}

function pathLooksFrontend(path) {
  return /\.(tsx|jsx|vue|svelte|css|scss|html)$/iu.test(path) || /(^|\/)(components|pages|app|routes|views)\//iu.test(path);
}

function pathLooksVisualizer(path) {
  return /visuali[sz]ers?|graph|tree|svg|canvas|chart|playback/iu.test(path);
}

function textMentionsInteraction(text) {
  const lower = text.toLowerCase();
  return INTERACTION_TERMS.some((term) => lower.includes(term));
}

function commandEvidenceText(...parts) {
  return parts.filter(Boolean).join("\n");
}

function checksForSop(sop) {
  return (sop.surfaces ?? []).flatMap((surface) => surface.checks ?? []);
}

function requireCheck(required, checks, id, reason) {
  const check = checks.find((item) => item.id === id) ?? { id, level: "unknown", command: null };
  if (!required.some((item) => item.id === id)) {
    required.push({ ...check, reason });
  }
}

export async function planTestSop(cwd, change, { changedPaths = null } = {}) {
  const sop = await scanTestSop(cwd);
  const changeRoot = join(cwd, "openspec", "changes", change);
  const verification = await readTextIfExists(join(changeRoot, "verification.md"));
  const explicitPaths = parseChangedPathsBlock(verification);
  let source = "verification";
  let paths = explicitPaths;

  if (changedPaths) {
    source = "override";
    paths = changedPaths;
  } else if (paths.length === 0) {
    const gitPaths = gitChangedPaths(cwd);
    if (gitPaths) {
      source = "git";
      paths = gitPaths;
    } else {
      source = "inferred";
      paths = [];
    }
  }

  const changeText = await readChangeText(cwd, change);
  const taskTests = parseTaskTestCases(await readChangeTasks(cwd, change));
  const checks = checksForSop(sop);
  const required = [];
  const frontendSurface = sop.surfaces?.find((surface) => surface.id === "frontend");
  const highConfidenceFrontend = frontendSurface?.confidence === "high";
  const frontendChanged = paths.some(pathLooksFrontend) || textMentionsInteraction(changeText);
  const visualizerChanged = paths.some(pathLooksVisualizer) || /visuali[sz]er|graph|tree|svg|canvas|playback|BST/iu.test(changeText);

  if (highConfidenceFrontend && frontendChanged) {
    requireCheck(required, checks, "frontend.typecheck", "Frontend implementation changed");
    requireCheck(required, checks, "frontend.build", "Frontend implementation changed");
    if (visualizerChanged) {
      requireCheck(required, checks, "frontend.runtime", "Visualizer or interactive UI changed");
      requireCheck(required, checks, "frontend.interaction.visualizer", "Visualizer or interactive UI behavior changed");
    }
  }

  const weakEvidenceRejected = highConfidenceFrontend && visualizerChanged ? [
    "typecheck/build/curl localhost do not prove frontend interaction behavior"
  ] : [];

  return {
    version: TEST_CONTEXT_SCHEMA_VERSION,
    change,
    projectType: sop.projectType,
    sopStatus: sop.status ?? "draft",
    sopQuestions: sop.questions ?? [],
    changedPathSource: source,
    changedPaths: paths,
    required,
    taskTests,
    weakEvidenceRejected
  };
}

async function evidenceText(cwd, change) {
  const root = join(cwd, "openspec", "changes", change);
  return commandEvidenceText(
    await readTextIfExists(join(root, "tasks.md")),
    await readTextIfExists(join(root, "evidence.md")),
    await readTextIfExists(join(root, "reviews", "implementation.md")),
    await readTextIfExists(join(root, "verification.md"))
  );
}

async function readStructuredEvidence(cwd, change) {
  return readJsonIfExists(join(cwd, "openspec", "changes", change, "test-evidence.json"));
}

function textCoversCheck(text, check) {
  if (!check.command || check.command === "project-specific browser/component test") {
    return false;
  }
  return text.includes(check.command);
}

function hasWeakEvidence(text) {
  return WEAK_FRONTEND_COMMANDS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

async function artifactExists(cwd, change, artifact) {
  const root = join(cwd, "openspec", "changes", change);
  return (await pathExists(join(root, artifact))) || (await pathExists(join(cwd, artifact)));
}

async function structuredCoversCheck(cwd, change, structured, check) {
  const entry = structured?.checks?.find((item) => item.id === check.id);
  if (!entry) {
    return { ok: false, reason: `Missing structured evidence for ${check.id}` };
  }
  if (entry.status !== "passed") {
    return { ok: false, reason: `Structured evidence for ${check.id} is not passed` };
  }
  if (entry.exitCode !== 0) {
    return { ok: false, reason: `Structured evidence for ${check.id} has non-zero exitCode` };
  }
  if (!Array.isArray(entry.assertions) || entry.assertions.length === 0) {
    return { ok: false, reason: `Structured evidence for ${check.id} must include assertions` };
  }
  for (const assertion of entry.assertions) {
    if (typeof assertion !== "string" || assertion.trim().length === 0) {
      return { ok: false, reason: `Structured evidence for ${check.id} has an empty assertion` };
    }
  }
  for (const artifact of entry.artifacts ?? []) {
    if (!(await artifactExists(cwd, change, artifact))) {
      return { ok: false, reason: `Structured evidence artifact missing for ${check.id}: ${artifact}` };
    }
  }
  return { ok: true, entry };
}

function assertionCoversTaskTest(assertion, taskTest) {
  const assertionText = typeof assertion === "string" ? assertion : JSON.stringify(assertion);
  const normalizedAssertion = assertionText.toLowerCase();
  const normalizedTask = taskTest.assertion.toLowerCase();
  if (normalizedAssertion.includes(normalizedTask)) return true;

  const meaningfulWords = unique(
    normalizedTask
      .replace(/[`"'.,:;()[\]{}]/gu, " ")
      .split(/\s+/u)
      .filter((word) => word.length >= 3)
  );
  if (meaningfulWords.length === 0) return false;
  const hits = meaningfulWords.filter((word) => normalizedAssertion.includes(word)).length;
  return hits >= Math.min(3, meaningfulWords.length);
}

function structuredAssertions(structured) {
  return (structured?.checks ?? []).flatMap((check) => check.assertions ?? []);
}

function requiresBehaviorEvidence(plan) {
  return (plan.required ?? []).some((check) => ["interaction", "runtime", "integration"].includes(check.level));
}

export async function verifyTestEvidence(cwd, change, options = {}) {
  if (options.disabled) {
    return {
      ok: true,
      disabled: true,
      change,
      failures: [],
      warnings: ["Test evidence verification disabled by --no-test-evidence"]
    };
  }

  const plan = await planTestSop(cwd, change, options);
  const text = await evidenceText(cwd, change);
  const structured = await readStructuredEvidence(cwd, change);
  const failures = [];
  const warnings = [];
  const weakEvidence = hasWeakEvidence(text);

  if (requiresBehaviorEvidence(plan)) {
    if (!["confirmed", "documented"].includes(plan.sopStatus)) {
      failures.push("Global test context must exist before behavior-level evidence can pass");
    }
    if (plan.sopQuestions.length > 0) {
      failures.push("Global test context has unresolved questions");
    }
  }

  for (const check of plan.required) {
    if (check.requiresStructuredEvidence || ["interaction", "runtime", "integration"].includes(check.level)) {
      const structuredResult = await structuredCoversCheck(cwd, change, structured, check);
      if (!structuredResult.ok) failures.push(structuredResult.reason);
      continue;
    }

    if (!textCoversCheck(text, check)) {
      failures.push(`Missing test evidence: ${check.id}`);
    }
  }

  if (plan.required.some((check) => check.level === "interaction") && weakEvidence.length > 0) {
    warnings.push("Weak frontend evidence observed but not accepted for interaction checks");
  }

  const assertions = structuredAssertions(structured);
  for (const taskTest of plan.taskTests ?? []) {
    if (!assertions.some((assertion) => assertionCoversTaskTest(assertion, taskTest))) {
      failures.push(`Missing structured assertion for task test ${taskTest.id}: ${taskTest.assertion}`);
    }
  }

  return {
    ok: failures.length === 0,
    disabled: false,
    change,
    plan,
    failures,
    warnings,
    weakEvidence
  };
}

export function formatTestSopFailures(result) {
  if (!result || result.ok) return [];
  return result.failures.map((failure) => `Test evidence invalid: ${failure}`);
}
