import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { inferState, inspectChange, verifyTransition } from "../lib/state-machine.js";
import { parseTasks } from "../lib/tasks.js";

async function writeFixture(root, change, files) {
  const changeRoot = join(root, "openspec", "changes", change);
  await mkdir(join(changeRoot, "reviews"), { recursive: true });
  await mkdir(join(changeRoot, "specs", "demo"), { recursive: true });

  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(changeRoot, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content);
  }

  await mkdir(join(root, "openspec"), { recursive: true });
  await mkdir(join(root, "openspec", "harness"), { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "project: test\n");
  await writeFile(join(root, "openspec", "harness", "constitution.md"), "# Constitution\n");
  await writeFile(join(root, "openspec", "harness", "test-context.md"), "# Test Context\nRun node --test.\n");
}

function approvedReview(scope = "Fixture review") {
  return `Status: approved

## Scope
${scope}

## Blocking Issues
None

## Non-blocking Concerns
None

## Assumptions Accepted
None

## Required Follow-ups
None

## Evidence Reviewed
- proposal.md
- tasks.md
`;
}

test("parseTasks tracks completion and evidence", () => {
  const tasks = parseTasks(`- [x] 1.1 Build gate
  - Evidence: npm test passed
- [ ] 1.2 Add docs
`);

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].done, true);
  assert.deepEqual(tasks[0].evidence, ["npm test passed"]);
  assert.equal(tasks[1].done, false);
});

test("state machine holds at applying when tasks are incomplete", async () => {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-state-"));
  await writeFixture(root, "add-demo", {
    "proposal.md": "## Why\nDemo\n",
    "design.md": "## Design\nDemo\n",
    "test.md": "## Test Plan\nRun node --test.\n",
    "tasks.md": "- [x] 1.1 Build API\n  - Evidence: node --test\n- [ ] 1.2 Add UI\n",
    "reviews/business.md": approvedReview("Business review"),
    "reviews/design.md": approvedReview("Design review"),
    "reviews/test.md": approvedReview("Test plan review")
  });

  const state = await inspectChange(root, "add-demo");
  assert.equal(inferState(state), "applying");

  const result = verifyTransition(state, "archive");
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /1 task\(s\) incomplete/u);
});

test("archive gate requires implementation review and evidence artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-state-"));
  await writeFixture(root, "add-demo", {
    "proposal.md": "## Why\nDemo\n",
    "design.md": "## Design\nDemo\n",
    "test.md": "## Test Plan\nRun node --test.\n",
    "tasks.md": "- [x] 1.1 Build API\n  - Evidence: node --test\n",
    "reviews/business.md": approvedReview("Business review"),
    "reviews/design.md": approvedReview("Design review"),
    "reviews/test.md": approvedReview("Test plan review")
  });

  const state = await inspectChange(root, "add-demo");
  const result = verifyTransition(state, "archive");

  assert.equal(inferState(state), "design_reviewed");
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Implementation review is not approved/u);
  assert.match(result.failures.join("\n"), /Missing evidence\.md/u);
});

test("apply gate requires global test context and change test plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-state-"));
  await writeFixture(root, "add-demo", {
    "proposal.md": "## Why\nDemo\n",
    "tasks.md": "- [ ] 1.1 Build API\n",
    "reviews/business.md": approvedReview("Business review")
  });
  await rm(join(root, "openspec", "harness", "test-context.md"));

  const state = await inspectChange(root, "add-demo");
  const result = verifyTransition(state, "apply");

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Missing openspec\/harness\/test-context\.md/u);
  assert.match(result.failures.join("\n"), /Missing test\.md/u);
});

test("apply gate requires approved test review when test plan exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-state-"));
  await writeFixture(root, "add-demo", {
    "proposal.md": "## Why\nDemo\n",
    "test.md": "## Test Plan\nRun node --test.\n",
    "tasks.md": "- [ ] 1.1 Build API\n",
    "reviews/business.md": approvedReview("Business review")
  });

  const state = await inspectChange(root, "add-demo");
  const result = verifyTransition(state, "apply");

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Test plan review is not approved/u);
});

test("archive gate passes with reviews, tasks, and evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-state-"));
  await writeFixture(root, "add-demo", {
    "proposal.md": "## Why\nDemo\n",
    "design.md": "## Design\nDemo\n",
    "test.md": "## Test Plan\nRun node --test.\n",
    "tasks.md": "- [x] 1.1 Build API\n  - Evidence: node --test\n",
    "reviews/business.md": approvedReview("Business review"),
    "reviews/design.md": approvedReview("Design review"),
    "reviews/test.md": approvedReview("Test plan review"),
    "reviews/implementation.md": approvedReview("Implementation review"),
    "evidence.md": "node --test passed\n"
  });

  const state = await inspectChange(root, "add-demo");
  const result = verifyTransition(state, "archive");

  assert.equal(inferState(state), "verified");
  assert.equal(result.ok, true);
});

test("review approval requires required headings and evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-state-"));
  await writeFixture(root, "add-demo", {
    "proposal.md": "## Why\nDemo\n",
    "design.md": "## Design\nDemo\n",
    "test.md": "## Test Plan\nRun node --test.\n",
    "tasks.md": "- [x] 1.1 Build API\n  - Evidence: node --test\n",
    "reviews/business.md": "Status: approved\n",
    "reviews/design.md": approvedReview("Design review"),
    "reviews/test.md": approvedReview("Test plan review")
  });

  const state = await inspectChange(root, "add-demo");
  const result = verifyTransition(state, "apply");

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Business review invalid: Missing review heading/u);
});

test("transition gates require constitution", async () => {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-state-"));
  await writeFixture(root, "add-demo", {
    "proposal.md": "## Why\nDemo\n",
    "design.md": "## Design\nDemo\n",
    "test.md": "## Test Plan\nRun node --test.\n",
    "tasks.md": "- [x] 1.1 Build API\n  - Evidence: node --test\n",
    "reviews/business.md": approvedReview("Business review"),
    "reviews/design.md": approvedReview("Design review"),
    "reviews/test.md": approvedReview("Test plan review"),
    "reviews/implementation.md": approvedReview("Implementation review"),
    "evidence.md": "node --test passed\n"
  });
  await rm(join(root, "openspec", "harness", "constitution.md"));

  const state = await inspectChange(root, "add-demo");
  const result = verifyTransition(state, "archive");

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Missing openspec\/harness\/constitution\.md/u);
});
