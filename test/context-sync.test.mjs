import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { syncContext, syncDocs } from "../lib/context-sync.js";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "openspec-context-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
  await writeFile(join(root, "README.md"), "mentions /openspec-harness:context-sync and /openspec-harness:docs-sync");
  await writeFile(join(root, "opencode.json"), JSON.stringify({
    command: {
      "openspec-harness:context-sync": { template: "Load and follow the skill `openspec-harness-context-sync`" },
      "openspec-harness:docs-sync": { template: "Load and follow the skill `openspec-harness-docs-sync`" },
      "openspec-harness:doctor": { template: "Run doctor checks without loading a skill" }
    }
  }));
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", "design.md"), "context docs");
  return root;
}

async function writeSkill(root, skill, manifestName = skill) {
  const dir = join(root, ".opencode", "skills", skill);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), [
    "---",
    `name: ${manifestName}`,
    "description: fixture skill",
    "---",
    "",
    "Fixture skill."
  ].join("\n"));
}

async function completeFixture() {
  const root = await fixture();
  await writeSkill(root, "openspec-harness-context-sync");
  await writeSkill(root, "openspec-harness-docs-sync");
  await mkdir(join(root, "openspec", "harness"), { recursive: true });
  await writeFile(join(root, "openspec", "harness", "context.md"), "# Project Context\n");
  await writeFile(join(root, "openspec", "harness", "test-context.md"), "# Test Context\n");
  return root;
}

test("syncContext classifies requirement pivots and writes context docs", async () => {
  const root = await fixture();
  const result = await syncContext(root, {
    feedback: "不是限制模型必须怎么做，而是帮助模型更好完成工作",
    change: "improve-context",
    write: true
  });

  assert.equal(result.classification.level, 3);
  assert.equal(result.classification.action, "realign-change");

  const context = await readFile(join(root, "openspec", "harness", "context.md"), "utf8");
  const decisions = await readFile(join(root, "openspec", "harness", "decision-log.md"), "utf8");
  assert.match(context, /帮助模型更好完成工作/u);
  assert.match(decisions, /Recommended Impact/u);
});

test("syncContext classifies empty feedback as context inspection", async () => {
  const root = await fixture();
  const result = await syncContext(root, { write: false });

  assert.equal(result.classification.level, 0);
  assert.equal(result.classification.action, "inspect-context");
});

test("syncContext classifies clarifications without forcing a pivot", async () => {
  const root = await fixture();
  const result = await syncContext(root, {
    feedback: "这里需要更新一下措辞，核心目标不变",
    write: false
  });

  assert.equal(result.classification.level, 1);
  assert.equal(result.classification.action, "update-context");
});

test("syncContext classifies testing feedback as test-plan impact", async () => {
  const root = await fixture();
  const result = await syncContext(root, {
    feedback: "前端类型项目需要实际启动浏览器验证",
    write: false
  });

  assert.equal(result.classification.level, 2);
  assert.equal(result.classification.action, "update-context-and-test-plan");
  assert.equal(result.write, false);
});

test("syncContext treats implementation contradiction as correction flow", async () => {
  const root = await fixture();
  const result = await syncContext(root, {
    feedback: "当前实现不符合我的纠偏，已经写的代码不对",
    write: false
  });

  assert.equal(result.classification.level, 4);
  assert.equal(result.classification.action, "correction-flow");
  assert.ok(result.recommendedImpacts.some((item) => item.includes("already written implementation")));
});

test("syncContext prioritizes pivots over test-plan words", async () => {
  const root = await fixture();
  const result = await syncContext(root, {
    feedback: "目标不是只做测试命令，而是重新调整成可运行系统",
    write: false
  });

  assert.equal(result.classification.level, 3);
  assert.equal(result.classification.action, "realign-change");
});

test("syncContext supports English pivot feedback", async () => {
  const root = await fixture();
  const result = await syncContext(root, {
    feedback: "This is a pivot: the goal is a runnable app, not a document.",
    write: false
  });

  assert.equal(result.classification.level, 3);
});

test("syncContext does not append duplicate context entries", async () => {
  const root = await fixture();
  const feedback = "需要更新 context 层，记录这次用户纠偏";
  await syncContext(root, { feedback, write: true });
  await syncContext(root, { feedback, write: true });

  const context = await readFile(join(root, "openspec", "harness", "context.md"), "utf8");
  assert.equal(context.match(new RegExp(feedback, "gu"))?.length, 1);
});

test("syncDocs reports command skill mismatches and missing context", async () => {
  const root = await fixture();

  const result = await syncDocs(root);

  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) => finding.message.includes("missing skill")));
  assert.ok(result.findings.some((finding) => finding.area === "context"));
});

test("syncDocs passes when commands, skills, and context docs align", async () => {
  const root = await completeFixture();

  const result = await syncDocs(root);

  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test("syncDocs warns when README omits public sync commands", async () => {
  const root = await completeFixture();
  await writeFile(join(root, "README.md"), "missing command names");

  const result = await syncDocs(root);

  assert.equal(result.ok, true);
  assert.ok(result.findings.some((finding) => finding.area === "readme"));
});

test("syncDocs errors when SKILL.md frontmatter name drifts", async () => {
  const root = await completeFixture();
  await writeSkill(root, "openspec-harness-docs-sync", "wrong-name");

  const result = await syncDocs(root);

  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) => finding.message.includes("wrong-name")));
});

test("syncDocs warns when design docs omit context synchronization", async () => {
  const root = await completeFixture();
  await writeFile(join(root, "docs", "design.md"), "architecture overview");

  const result = await syncDocs(root);

  assert.equal(result.ok, true);
  assert.ok(result.findings.some((finding) => finding.area === "design"));
});
