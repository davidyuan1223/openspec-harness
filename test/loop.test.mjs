import assert from "node:assert/strict";
import test from "node:test";

import { executeLoopStep, recommendNextAction } from "../lib/loop.js";

function baseState(overrides = {}) {
  return {
    constitution: { present: true },
    testContext: { present: true },
    artifacts: {
      proposal: true,
      design: true,
      test: true,
      tasks: true,
      evidence: true
    },
    reviews: {
      business: { status: "approved", valid: true, failures: [] },
      design: { status: "approved", valid: true, failures: [] },
      test: { status: "approved", valid: true, failures: [] },
      implementation: { status: "approved", valid: true, failures: [] }
    },
    taskSummary: {
      total: 1,
      completed: 1,
      incomplete: 0,
      completedWithoutEvidence: []
    },
    ...overrides
  };
}

test("loop recommends constitution before any phase work", () => {
  const recommendation = recommendNextAction(baseState({ constitution: { present: false } }));

  assert.equal(recommendation.action, "create-constitution");
  assert.equal(recommendation.blocked, true);
});

test("loop recommends apply when apply gates pass and tasks remain", () => {
  const recommendation = recommendNextAction(
    baseState({
      taskSummary: {
        total: 2,
        completed: 1,
        incomplete: 1,
        completedWithoutEvidence: []
      }
    })
  );

  assert.equal(recommendation.action, "apply-next-task");
  assert.equal(recommendation.blocked, false);
});

test("loop blocks on missing test context before proposal work", () => {
  const recommendation = recommendNextAction(baseState({ testContext: { present: false } }));

  assert.equal(recommendation.action, "create-test-context");
  assert.equal(recommendation.blocked, true);
  assert.match(recommendation.reasons.join("\n"), /test-context/u);
});

test("loop blocks on missing test plan after proposal", () => {
  const recommendation = recommendNextAction(
    baseState({
      artifacts: {
        proposal: true,
        design: false,
        test: false,
        tasks: true,
        evidence: false
      }
    })
  );

  assert.equal(recommendation.action, "create-test-plan");
  assert.equal(recommendation.blocked, true);
});

test("loop recommends test review before apply", () => {
  const recommendation = recommendNextAction(
    baseState({
      artifacts: {
        proposal: true,
        design: false,
        test: true,
        tasks: true,
        evidence: false
      },
      reviews: {
        business: { status: "approved", valid: true, failures: [] },
        design: { status: "missing", valid: false, failures: [] },
        test: { status: "missing", valid: false, failures: [] },
        implementation: { status: "missing", valid: false, failures: [] }
      }
    })
  );

  assert.equal(recommendation.action, "test-review");
  assert.equal(recommendation.blocked, true);
});

test("loop recommends archive when archive gates pass", () => {
  const recommendation = recommendNextAction(baseState());

  assert.equal(recommendation.action, "archive");
  assert.equal(recommendation.blocked, false);
});

test("loop execution refuses archive without explicit allow flag", () => {
  const execution = executeLoopStep({
    change: "add-demo",
    cwd: "/repo",
    recommendation: recommendNextAction(baseState()),
    runner: () => {
      throw new Error("runner should not be called");
    }
  });

  assert.equal(execution.executed, false);
  assert.equal(execution.ok, false);
  assert.match(execution.reason, /requires --allow-archive/u);
});

test("loop execution archives and validates with explicit allow flag", () => {
  const calls = [];
  const execution = executeLoopStep({
    change: "add-demo",
    cwd: "/repo",
    recommendation: recommendNextAction(baseState()),
    allowArchive: true,
    runner: (...args) => {
      calls.push(args);
      return { status: 0, stdout: `${args[0]} ${args[1].join(" ")}\n`, stderr: "" };
    }
  });

  assert.equal(execution.executed, true);
  assert.equal(execution.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0][1], ["archive", "add-demo", "--yes"]);
  assert.deepEqual(calls[1][1], ["validate", "--all", "--strict", "--no-interactive"]);
});

test("loop execution does not auto-run agent work", () => {
  const execution = executeLoopStep({
    change: "add-demo",
    cwd: "/repo",
    recommendation: recommendNextAction(
      baseState({
        taskSummary: {
          total: 2,
          completed: 1,
          incomplete: 1,
          completedWithoutEvidence: []
        }
      })
    ),
    allowArchive: true,
    runner: () => {
      throw new Error("runner should not be called");
    }
  });

  assert.equal(execution.executed, false);
  assert.equal(execution.ok, true);
  assert.match(execution.reason, /requires agent or human work/u);
});
