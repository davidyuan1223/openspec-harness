import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pathExists, readTextIfExists } from "./fs-utils.js";

const CONTEXT_DIR = ["openspec", "harness"];
const CONTEXT_FILE = "context.md";
const DECISION_LOG_FILE = "decision-log.md";

const CORRECTION_PATTERNS = [
  /不对/u,
  /不是(?:这个|这样|这个意思)/u,
  /我要的是/u,
  /其实应该/u,
  /理解错/u,
  /需求变了/u,
  /改成/u,
  /需要更新/u,
  /realign/iu,
  /sync context/iu
];

const PIVOT_PATTERNS = [
  /不是.*而是/u,
  /不是.*是/u,
  /目标.*不是/u,
  /直接可用/u,
  /重新/u,
  /推翻/u,
  /pivot/iu
];

const TEST_PATTERNS = [
  /测试/u,
  /验证/u,
  /前端/u,
  /浏览器/u,
  /运行/u,
  /test/iu,
  /verify/iu,
  /playwright/iu
];

const IMPLEMENTATION_CONTRADICTION_PATTERNS = [
  /实现.*(?:不对|错误|偏离|不符合|不是)/u,
  /代码.*(?:不对|错误|偏离|不符合|不是)/u,
  /已经.*(?:实现|写).*不对/u,
  /当前.*(?:实现|代码).*(?:不符合|不对|错|偏离)/u,
  /implementation.*(?:wrong|drift|contradict|does not match)/iu,
  /code.*(?:wrong|drift|does not match)/iu
];

function harnessPath(cwd, file) {
  return join(cwd, ...CONTEXT_DIR, file);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeFeedback(feedback) {
  return String(feedback ?? "").trim();
}

function classifyFeedback(feedback) {
  const text = normalizeFeedback(feedback);
  const hasCorrection = CORRECTION_PATTERNS.some((pattern) => pattern.test(text));
  const isPivot = PIVOT_PATTERNS.some((pattern) => pattern.test(text));
  const touchesTesting = TEST_PATTERNS.some((pattern) => pattern.test(text));
  const contradictsImplementation = IMPLEMENTATION_CONTRADICTION_PATTERNS.some((pattern) => pattern.test(text));

  if (!text) {
    return {
      level: 0,
      action: "inspect-context",
      reason: "No feedback text was supplied; inspect existing context only."
    };
  }

  if (contradictsImplementation) {
    return {
      level: 4,
      action: "correction-flow",
      reason: "Feedback indicates the current implementation may contradict corrected user intent."
    };
  }

  if (isPivot) {
    return {
      level: 3,
      action: "realign-change",
      reason: "Feedback appears to change the product intent or key workflow."
    };
  }

  if (touchesTesting) {
    return {
      level: 2,
      action: "update-context-and-test-plan",
      reason: "Feedback affects verification strategy or test environment assumptions."
    };
  }

  if (hasCorrection) {
    return {
      level: 1,
      action: "update-context",
      reason: "Feedback clarifies user intent without necessarily replacing the active change."
    };
  }

  return {
    level: 1,
    action: "record-context-note",
    reason: "Feedback is relevant context and should be recorded for future agent turns."
  };
}

function renderContext({ existing, feedback, classification, change }) {
  const body = existing?.trim()
    ? existing.trim()
    : [
        "# Project Context",
        "",
        "## Purpose",
        "Maintain long-lived project facts, user preferences, and alignment notes that sit above individual OpenSpec changes.",
        "",
        "## Current Understanding",
        "- OpenSpec Harness should help the agent work better by preserving context, recommending reliable next actions, and validating evidence.",
        "- Hard gates are reserved for high-risk transitions such as implementation writes and archive; context guidance should primarily improve confidence.",
        "",
        "## User Preferences",
        "- Prefer runnable implementation, verification evidence, and concrete integration tests over document-only claims.",
        "- When user feedback contradicts prior assumptions, realign context before continuing the old plan.",
        "",
        "## Common Drift Risks",
        "- Treating build/typecheck as proof of frontend behavior.",
        "- Continuing an old proposal after the user corrected the intended outcome.",
        "- Letting README/design/context docs drift from actual plugin tools, skills, and hooks.",
        "",
        "## Recent Corrections"
      ].join("\n");

  if (!feedback || body.includes(feedback)) return `${body}\n`;

  return [
    body,
    "",
    `- ${nowIso()}: ${classification.action}${change ? ` for \`${change}\`` : ""}. ${feedback}`
  ].join("\n");
}

function renderDecisionLogEntry({ feedback, classification, change }) {
  return [
    "",
    `## ${nowIso()} Context Sync${change ? `: ${change}` : ""}`,
    "",
    `Level: ${classification.level}`,
    `Action: ${classification.action}`,
    `Reason: ${classification.reason}`,
    "",
    "### User Feedback",
    feedback || "(none supplied)",
    "",
    "### Recommended Impact",
    ...recommendedImpacts(classification).map((item) => `- ${item}`),
    ""
  ].join("\n");
}

function recommendedImpacts(classification) {
  if (classification.level >= 4) {
    return [
      "Update project context before continuing.",
      "Revisit active proposal, design, tasks, and test plan.",
      "Treat already written implementation as suspect until re-verified against the corrected intent."
    ];
  }

  if (classification.level === 3) {
    return [
      "Update project context before continuing.",
      "Revisit active proposal, design, tasks, and test plan."
    ];
  }

  if (classification.level === 2) {
    return [
      "Update project context.",
      "Review or update the active change test plan.",
      "Run test review again if test expectations materially changed."
    ];
  }

  if (classification.level === 1) {
    return [
      "Record the clarification in context.",
      "Continue the active change if proposal and tests still match the clarified intent."
    ];
  }

  return ["Inspect context and decide whether any active change needs updates."];
}

export async function syncContext(cwd, { feedback = "", change = null, write = false } = {}) {
  const text = normalizeFeedback(feedback);
  const classification = classifyFeedback(text);
  const contextPath = harnessPath(cwd, CONTEXT_FILE);
  const decisionLogPath = harnessPath(cwd, DECISION_LOG_FILE);
  const existingContext = await readTextIfExists(contextPath);
  const contextPresent = Boolean(existingContext?.trim());
  const outputContext = renderContext({
    existing: existingContext,
    feedback: text,
    classification,
    change
  });
  const decisionEntry = renderDecisionLogEntry({ feedback: text, classification, change });

  if (write) {
    await mkdir(join(cwd, ...CONTEXT_DIR), { recursive: true });
    await writeFile(contextPath, outputContext);
    const existingDecisionLog = await readTextIfExists(decisionLogPath);
    const header = existingDecisionLog?.trim() ? existingDecisionLog.trim() : "# Decision Log\n";
    await writeFile(decisionLogPath, `${header}\n${decisionEntry}`);
  }

  return {
    contextPresent,
    contextPath,
    decisionLogPath,
    feedback: text,
    change,
    write,
    classification,
    recommendedImpacts: recommendedImpacts(classification),
    preview: {
      contextAppend: text ? `- ${classification.action}${change ? ` for ${change}` : ""}: ${text}` : null,
      decisionLogEntry: decisionEntry.trim()
    }
  };
}

async function listSkillNames(cwd) {
  const skillsRoot = join(cwd, ".opencode", "skills");
  if (!(await pathExists(skillsRoot))) return [];
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function readSkillManifest(cwd, skill) {
  const skillPath = join(cwd, ".opencode", "skills", skill, "SKILL.md");
  const text = await readTextIfExists(skillPath);
  return {
    skill,
    path: skillPath,
    text,
    name: text ? /^name:\s*(.+)$/mu.exec(text)?.[1]?.trim() : null
  };
}

async function readJson(path) {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}

function commandNames(config) {
  return Object.keys(config.command ?? {}).sort();
}

function expectedSkillForCommand(command, entry) {
  if (!entry?.template?.includes("Load and follow the skill")) return null;
  return command.startsWith("openspec-harness:")
    ? `openspec-harness-${command.split(":")[1]}`
    : null;
}

export async function syncDocs(cwd) {
  const opencodePath = join(cwd, "opencode.json");
  const packagePath = join(cwd, "package.json");
  const readme = await readTextIfExists(join(cwd, "README.md"));
  const design = await readTextIfExists(join(cwd, "docs", "design.md"));
  const context = await readTextIfExists(harnessPath(cwd, CONTEXT_FILE));
  const testContext = await readTextIfExists(harnessPath(cwd, "test-context.md"));
  const config = await readJson(opencodePath);
  const pkg = await readJson(packagePath);
  const skills = await listSkillNames(cwd);
  const skillManifests = await Promise.all(skills.map((skill) => readSkillManifest(cwd, skill)));
  const commands = commandNames(config);
  const expectedSkills = commands
    .map((command) => expectedSkillForCommand(command, config.command?.[command]))
    .filter(Boolean);
  const findings = [];

  for (const skill of expectedSkills) {
    if (!skills.includes(skill)) {
      findings.push({
        severity: "error",
        area: "skills",
        message: `Command requires missing skill ${skill}.`
      });
      continue;
    }

    const manifest = skillManifests.find((entry) => entry.skill === skill);
    if (!manifest?.text) {
      findings.push({
        severity: "error",
        area: "skills",
        message: `Skill ${skill} is missing SKILL.md.`
      });
    } else if (manifest.name !== skill) {
      findings.push({
        severity: "error",
        area: "skills",
        message: `Skill ${skill} has SKILL.md name ${manifest.name ?? "(missing)"}.`
      });
    }
  }

  for (const skill of skills) {
    const command = `openspec-harness:${skill.replace(/^openspec-harness-/u, "")}`;
    if (!commands.includes(command)) {
      findings.push({
        severity: "warning",
        area: "commands",
        message: `Skill ${skill} has no matching user command ${command}.`
      });
    }
  }

  for (const name of ["context-sync", "docs-sync"]) {
    if (commands.includes(`openspec-harness:${name}`) && !readme?.includes(`openspec-harness:${name}`)) {
      findings.push({
        severity: "warning",
        area: "readme",
        message: `README does not mention /openspec-harness:${name}.`
      });
    }
  }

  if (!context?.trim()) {
    findings.push({
      severity: "warning",
      area: "context",
      message: "openspec/harness/context.md is missing or empty."
    });
  }

  if (!testContext?.trim()) {
    findings.push({
      severity: "warning",
      area: "test-context",
      message: "openspec/harness/test-context.md is missing or empty."
    });
  }

  if (!design?.includes("context")) {
    findings.push({
      severity: "warning",
      area: "design",
      message: "docs/design.md does not describe context synchronization."
    });
  }

  return {
    ok: !findings.some((finding) => finding.severity === "error"),
    packageName: pkg.name,
    version: pkg.version,
    commands,
    skills,
    skillManifests: skillManifests.map((manifest) => ({
      skill: manifest.skill,
      name: manifest.name,
      hasReadme: Boolean(manifest.text)
    })),
    contextPresent: Boolean(context?.trim()),
    testContextPresent: Boolean(testContext?.trim()),
    findings
  };
}
