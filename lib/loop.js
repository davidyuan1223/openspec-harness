import { inferState, verifyTransition } from "./state-machine.js";

export function recommendNextAction(changeState) {
  const state = inferState(changeState);
  const applyGate = verifyTransition(changeState, "apply");
  const archiveGate = verifyTransition(changeState, "archive");

  if (!changeState.constitution.present) {
    return {
      state,
      action: "create-constitution",
      command: "Create openspec/harness/constitution.md",
      blocked: true,
      reasons: ["Missing openspec/harness/constitution.md"]
    };
  }

  if (!changeState.testContext?.present) {
    return {
      state,
      action: "create-test-context",
      command: "/openspec-harness:explore <change>",
      blocked: true,
      reasons: ["Missing openspec/harness/test-context.md"]
    };
  }

  if (!changeState.artifacts.proposal) {
    return {
      state,
      action: "explore-or-propose",
      command: "/openspec-harness:explore then /openspec-harness:propose",
      blocked: false,
      reasons: []
    };
  }

  if (!changeState.artifacts.test) {
    return {
      state,
      action: "create-test-plan",
      command: "/openspec-harness:propose <change>",
      blocked: true,
      reasons: ["Missing test.md"]
    };
  }

  if (changeState.reviews.business.status !== "approved" || !changeState.reviews.business.valid) {
    return {
      state,
      action: "business-review",
      command: "/openspec-harness:review business <change>",
      blocked: true,
      reasons: ["Business review must be approved and valid"]
    };
  }

  if (
    changeState.artifacts.design &&
    (changeState.reviews.design.status !== "approved" || !changeState.reviews.design.valid)
  ) {
    return {
      state,
      action: "design-review",
      command: "/openspec-harness:review design <change>",
      blocked: true,
      reasons: ["Design review must be approved and valid"]
    };
  }

  if (
    changeState.artifacts.test &&
    (changeState.reviews.test.status !== "approved" || !changeState.reviews.test.valid)
  ) {
    return {
      state,
      action: "test-review",
      command: "/openspec-harness:review test <change>",
      blocked: true,
      reasons: ["Test plan review must be approved and valid"]
    };
  }

  if (!applyGate.ok) {
    return {
      state,
      action: "fix-apply-gates",
      command: "node ./bin/openspec-harness.mjs verify --mode apply --change <change>",
      blocked: true,
      reasons: applyGate.failures
    };
  }

  if (changeState.taskSummary.incomplete > 0 || changeState.taskSummary.total === 0) {
    return {
      state,
      action: "apply-next-task",
      command: "/openspec-harness:apply <change>",
      blocked: false,
      reasons: []
    };
  }

  if (
    changeState.reviews.implementation.status !== "approved" ||
    !changeState.reviews.implementation.valid
  ) {
    return {
      state,
      action: "implementation-review",
      command: "/openspec-harness:review implementation <change>",
      blocked: true,
      reasons: ["Implementation review must be approved and valid before archive"]
    };
  }

  if (!archiveGate.ok) {
    return {
      state,
      action: "fix-archive-gates",
      command: "node ./bin/openspec-harness.mjs verify --mode archive --change <change>",
      blocked: true,
      reasons: archiveGate.failures
    };
  }

  return {
    state,
    action: "archive",
    command: "/openspec-harness:archive <change>",
    blocked: false,
    reasons: []
  };
}

export function executeLoopStep({
  change,
  cwd,
  recommendation,
  runner,
  allowArchive = false
}) {
  if (!recommendation || recommendation.blocked) {
    return {
      executed: false,
      action: recommendation?.action ?? "unknown",
      ok: false,
      reason: "Loop recommendation is blocked"
    };
  }

  if (recommendation.action !== "archive") {
    return {
      executed: false,
      action: recommendation.action,
      ok: true,
      reason: "Action requires agent or human work; no automatic command executed"
    };
  }

  if (!allowArchive) {
    return {
      executed: false,
      action: "archive",
      ok: false,
      reason: "Archive execution requires --allow-archive"
    };
  }

  const archive = runner("openspec", ["archive", change, "--yes"], {
    cwd,
    encoding: "utf8"
  });

  if (archive.status !== 0) {
    return {
      executed: true,
      action: "archive",
      ok: false,
      stdout: archive.stdout ?? "",
      stderr: archive.stderr ?? "",
      reason: "openspec archive failed"
    };
  }

  const validate = runner("openspec", ["validate", "--all", "--strict", "--no-interactive"], {
    cwd,
    encoding: "utf8"
  });

  return {
    executed: true,
    action: "archive",
    ok: validate.status === 0,
    stdout: `${archive.stdout ?? ""}${validate.stdout ?? ""}`,
    stderr: `${archive.stderr ?? ""}${validate.stderr ?? ""}`,
    reason: validate.status === 0 ? "Archive executed and validation passed" : "Post-archive validation failed"
  };
}
