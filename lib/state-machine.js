import { join } from "node:path";

import { listDirectories, pathExists, readTextIfExists } from "./fs-utils.js";
import { parseTasks } from "./tasks.js";

export const STATES = [
  "idle",
  "exploring",
  "proposed",
  "proposal_reviewed",
  "design_reviewed",
  "applying",
  "implementation_reviewed",
  "verified",
  "archived"
];

export const REQUIRED_REVIEW_HEADINGS = [
  "Scope",
  "Blocking Issues",
  "Non-blocking Concerns",
  "Assumptions Accepted",
  "Required Follow-ups",
  "Evidence Reviewed"
];

function sectionContent(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(
    `^##\\s+${escaped}\\s*$\\n(?<body>[\\s\\S]*?)(?=^##\\s+|$(?![\\s\\S]))`,
    "imu"
  ).exec(content);

  return match?.groups?.body.trim() ?? "";
}

export function parseReview(content) {
  if (!content) {
    return {
      status: "missing",
      valid: false,
      missingHeadings: [...REQUIRED_REVIEW_HEADINGS],
      failures: ["Review artifact is missing"]
    };
  }

  const statusMatch = /^Status:\s*(?<status>approved|rejected)\s*$/imu.exec(content);
  const status = statusMatch?.groups?.status ?? "pending";
  const missingHeadings = REQUIRED_REVIEW_HEADINGS.filter(
    (heading) => !new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*$`, "imu").test(content)
  );
  const failures = [];

  if (!statusMatch) {
    failures.push("Missing `Status: approved` or `Status: rejected`");
  }

  for (const heading of missingHeadings) {
    failures.push(`Missing review heading: ${heading}`);
  }

  const blockingIssues = sectionContent(content, "Blocking Issues");
  const evidenceReviewed = sectionContent(content, "Evidence Reviewed");

  if (status === "approved" && !/^none\.?$/iu.test(blockingIssues)) {
    failures.push("Approved review must have `None` under Blocking Issues");
  }

  if (!evidenceReviewed || /^none\.?$/iu.test(evidenceReviewed)) {
    failures.push("Review must list concrete Evidence Reviewed");
  }

  return {
    status,
    valid: failures.length === 0,
    missingHeadings,
    failures
  };
}

function hasContent(content) {
  return typeof content === "string" && content.trim().length > 0;
}

export async function discoverChanges(cwd) {
  return listDirectories(join(cwd, "openspec", "changes"));
}

export async function inspectChange(cwd, change) {
  const root = join(cwd, "openspec", "changes", change);
  const constitution = await readTextIfExists(join(cwd, "openspec", "harness", "constitution.md"));
  const testContext = await readTextIfExists(join(cwd, "openspec", "harness", "test-context.md"));
  const proposal = await readTextIfExists(join(root, "proposal.md"));
  const design = await readTextIfExists(join(root, "design.md"));
  const testPlan = await readTextIfExists(join(root, "test.md"));
  const tasksText = await readTextIfExists(join(root, "tasks.md"));
  const evidence = await readTextIfExists(join(root, "evidence.md"));
  const businessReview = await readTextIfExists(join(root, "reviews", "business.md"));
  const designReview = await readTextIfExists(join(root, "reviews", "design.md"));
  const testReview = await readTextIfExists(join(root, "reviews", "test.md"));
  const implementationReview = await readTextIfExists(
    join(root, "reviews", "implementation.md")
  );
  const archivedSpec = await pathExists(join(cwd, "openspec", "specs"));
  const tasks = tasksText ? parseTasks(tasksText) : [];
  const completedTasks = tasks.filter((task) => task.done);
  const incompleteTasks = tasks.filter((task) => !task.done);
  const completedWithoutEvidence = completedTasks.filter((task) => task.evidence.length === 0);

  return {
    change,
    root,
    constitution: {
      present: hasContent(constitution)
    },
    testContext: {
      present: hasContent(testContext)
    },
    artifacts: {
      proposal: hasContent(proposal),
      design: hasContent(design),
      test: hasContent(testPlan),
      tasks: hasContent(tasksText),
      evidence: hasContent(evidence)
    },
    reviews: {
      business: parseReview(businessReview),
      design: parseReview(designReview),
      test: parseReview(testReview),
      implementation: parseReview(implementationReview)
    },
    tasks,
    taskSummary: {
      total: tasks.length,
      completed: completedTasks.length,
      incomplete: incompleteTasks.length,
      completedWithoutEvidence: completedWithoutEvidence.map((task) => task.label)
    },
    archivedSpec
  };
}

export function inferState(changeState) {
  if (!changeState?.artifacts?.proposal) {
    return "exploring";
  }

  if (changeState.reviews.business.status !== "approved" || !changeState.reviews.business.valid) {
    return "proposed";
  }

  if (
    changeState.artifacts.design &&
    (changeState.reviews.design.status !== "approved" || !changeState.reviews.design.valid)
  ) {
    return "proposal_reviewed";
  }

  if (
    changeState.artifacts.test &&
    (changeState.reviews.test.status !== "approved" || !changeState.reviews.test.valid)
  ) {
    return "proposal_reviewed";
  }

  if (changeState.taskSummary.total === 0 || changeState.taskSummary.incomplete > 0) {
    return "applying";
  }

  if (
    changeState.reviews.implementation.status !== "approved" ||
    !changeState.reviews.implementation.valid
  ) {
    return "design_reviewed";
  }

  if (changeState.taskSummary.completedWithoutEvidence.length > 0 || !changeState.artifacts.evidence) {
    return "implementation_reviewed";
  }

  return "verified";
}

export function verifyTransition(changeState, target = "archive") {
  const failures = [];

  if (!changeState.constitution.present) {
    failures.push("Missing openspec/harness/constitution.md");
  }

  if (!changeState.testContext?.present) {
    failures.push("Missing openspec/harness/test-context.md");
  }

  if (!changeState.artifacts.proposal) {
    failures.push("Missing proposal.md");
  }

  if (!changeState.artifacts.test) {
    failures.push("Missing test.md");
  }

  if (!changeState.artifacts.tasks) {
    failures.push("Missing tasks.md");
  }

  if (changeState.reviews.business.status !== "approved") {
    failures.push("Business review is not approved");
  }

  if (!changeState.reviews.business.valid) {
    failures.push(
      ...changeState.reviews.business.failures.map((failure) => `Business review invalid: ${failure}`)
    );
  }

  if (changeState.artifacts.design && changeState.reviews.design.status !== "approved") {
    failures.push("Design review is not approved");
  }

  if (changeState.artifacts.design && !changeState.reviews.design.valid) {
    failures.push(
      ...changeState.reviews.design.failures.map((failure) => `Design review invalid: ${failure}`)
    );
  }

  if (changeState.artifacts.test && changeState.reviews.test.status !== "approved") {
    failures.push("Test plan review is not approved");
  }

  if (changeState.artifacts.test && !changeState.reviews.test.valid) {
    failures.push(
      ...changeState.reviews.test.failures.map((failure) => `Test plan review invalid: ${failure}`)
    );
  }

  if (target === "apply" && changeState.taskSummary.total === 0) {
    failures.push("No implementation tasks found");
  }

  if (target === "archive") {
    if (changeState.taskSummary.total === 0) {
      failures.push("No implementation tasks found");
    }

    if (changeState.taskSummary.incomplete > 0) {
      failures.push(`${changeState.taskSummary.incomplete} task(s) incomplete`);
    }

    for (const label of changeState.taskSummary.completedWithoutEvidence) {
      failures.push(`Completed task lacks evidence: ${label}`);
    }
  }

  if (target === "archive") {
    if (changeState.reviews.implementation.status !== "approved") {
      failures.push("Implementation review is not approved");
    }

    if (!changeState.reviews.implementation.valid) {
      failures.push(
        ...changeState.reviews.implementation.failures.map(
          (failure) => `Implementation review invalid: ${failure}`
        )
      );
    }

    if (!changeState.artifacts.evidence) {
      failures.push("Missing evidence.md");
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}
