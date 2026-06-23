import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const config = JSON.parse(await readFile("opencode.json", "utf8"));
const commands = Object.keys(config.command ?? {});

for (const name of [
  "openspec-harness:explore",
  "openspec-harness:propose",
  "openspec-harness:review",
  "openspec-harness:apply",
  "openspec-harness:verify",
  "openspec-harness:archive",
  "openspec-harness:status",
  "openspec-harness:doctor",
  "openspec-harness:loop",
  "openspec-harness:context-sync",
  "openspec-harness:docs-sync"
]) {
  assert(commands.includes(name), `Missing OpenCode command: ${name}`);
}

const pluginWrapper = await readFile(".opencode/plugins/openspec-harness.ts", "utf8");
assert.match(pluginWrapper, /createOpenSpecHarnessPlugin/u);

const pluginRuntime = await readFile("lib/opencode-plugin.js", "utf8");
assert.match(pluginRuntime, /tool\.execute\.before/u);
assert.match(pluginRuntime, /OPENSPEC_HARNESS_SYSTEM_CONTEXT/u);
assert.match(pluginRuntime, /openspec_harness_status/u);
assert.match(pluginRuntime, /openspec_harness_verify/u);
assert.match(pluginRuntime, /openspec_harness_loop/u);
assert.match(pluginRuntime, /openspec_harness_scan_test_context/u);
assert.match(pluginRuntime, /openspec_harness_plan_change_tests/u);
assert.match(pluginRuntime, /openspec_harness_verify_test_evidence/u);
assert.match(pluginRuntime, /openspec_harness_context_sync/u);
assert.match(pluginRuntime, /openspec_harness_docs_sync/u);

const skillNameRe = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
const skillRoot = ".opencode/skills";
const skills = await readdir(skillRoot);
const expectedSkills = [
  "openspec-harness-explore",
  "openspec-harness-propose",
  "openspec-harness-review",
  "openspec-harness-apply",
  "openspec-harness-verify",
  "openspec-harness-archive",
  "openspec-harness-status",
  "openspec-harness-loop",
  "openspec-harness-context-sync",
  "openspec-harness-docs-sync"
];

for (const skill of expectedSkills) {
  assert(skills.includes(skill), `Missing OpenCode skill: ${skill}`);
  assert(skillNameRe.test(skill), `Invalid OpenCode skill name: ${skill}`);

  const content = await readFile(join(skillRoot, skill, "SKILL.md"), "utf8");
  assert.match(content, /^---\r?\n/u, `Missing frontmatter in ${skill}`);
  assert.match(content, new RegExp(`^name:\\s*${skill}\\s*$`, "mu"));
  assert.match(content, /^description:\s+.{1,1024}$/mu, `Missing description in ${skill}`);
}

process.stdout.write("OpenCode fixture shape is valid.\n");
