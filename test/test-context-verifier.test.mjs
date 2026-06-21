import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  parseTaskTestCases,
  planTestSop,
  scanTestSop,
  verifyTestEvidence
} from "../lib/test-context-verifier.js";

async function writeProjectFile(root, path, content) {
  const fullPath = join(root, path);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, content);
}

async function createFrontendFixture() {
  const root = await mkdtemp(join(tmpdir(), "openspec-harness-sop-"));
  await writeProjectFile(root, "package.json", JSON.stringify({
    scripts: {
      typecheck: "tsc --noEmit",
      build: "vite build",
      dev: "vite --host 127.0.0.1",
      "test:e2e": "playwright test"
    },
    dependencies: {
      "@vitejs/plugin-react": "latest",
      vite: "latest",
      react: "latest"
    }
  }, null, 2));
  await writeProjectFile(root, "vite.config.ts", "export default {};\n");
  await writeProjectFile(root, "src/components/Visualizers/GraphView.tsx", "export default function GraphView() { return null; }\n");
  await writeProjectFile(root, "openspec/harness/constitution.md", "# Constitution\n");
  await writeProjectFile(root, "openspec/changes/polish/proposal.md", "## Why\nPolish GraphView and BST playback.\n");
  await writeProjectFile(root, "openspec/changes/polish/tasks.md", `- [x] 1.1 Polish graph visualizer
  - Evidence: npm run typecheck passed
  - Evidence: npm run build passed
  - Evidence: curl http://localhost:5173 | head -1 returned HTML
`);
  await writeProjectFile(root, "openspec/changes/polish/evidence.md", `npm run typecheck passed
npm run build passed
curl http://localhost:5173 | head -1 returned HTML
`);
  await writeProjectFile(root, "openspec/changes/polish/reviews/implementation.md", `Status: approved

## Scope
GraphView polish.

## Blocking Issues
None

## Non-blocking Concerns
None

## Assumptions Accepted
None

## Required Follow-ups
None

## Evidence Reviewed
- npm run typecheck
- npm run build
- curl localhost
`);
  await writeProjectFile(root, "openspec/changes/polish/verification.md", `## Changed Paths
- src/components/Visualizers/GraphView.tsx
`);
  return root;
}

async function writeDocumentedFrontendTestContext(root) {
  await writeProjectFile(root, "openspec/harness/test-context.md", `# Test Context

## Project Type
frontend

## Runtime
- Install dependencies with npm install.
- Start the app with npm run dev.
- Verify visualizer behavior with npm run test:e2e.
`);
}

test("scanTestSop detects Vite frontend checks", async () => {
  const root = await createFrontendFixture();

  const sop = await scanTestSop(root);
  const frontend = sop.surfaces.find((surface) => surface.id === "frontend");

  assert.equal(sop.projectType, "frontend");
  assert.equal(sop.status, "draft");
  assert.equal(sop.source, "scanner");
  assert.equal(frontend.confidence, "high");
  assert.deepEqual(
    frontend.checks.map((check) => check.id),
    [
      "frontend.typecheck",
      "frontend.build",
      "frontend.runtime",
      "frontend.interaction.visualizer"
    ]
  );
});

test("scanTestSop emits questions when interaction command is unknown", async () => {
  const root = await createFrontendFixture();
  await writeProjectFile(root, "package.json", JSON.stringify({
    scripts: {
      typecheck: "tsc --noEmit",
      build: "vite build",
      dev: "vite --host 127.0.0.1"
    },
    dependencies: {
      vite: "latest",
      react: "latest"
    }
  }, null, 2));

  const sop = await scanTestSop(root);

  assert(sop.questions.some((question) => question.id === "frontend.interaction.command"));
});

test("parseTaskTestCases extracts functional tests from tasks", () => {
  const tests = parseTaskTestCases(`- [ ] 1.1 Implement BST playback
  - Test: Select inorder traversal and assert highlighted values are 2,3,4,5,6,7,8.
  - Test Case: Insert 9 and assert final SVG contains node 9.
`);

  assert.deepEqual(tests, [
    {
      id: "task-test-1",
      task: "1.1 Implement BST playback",
      assertion: "Select inorder traversal and assert highlighted values are 2,3,4,5,6,7,8."
    },
    {
      id: "task-test-2",
      task: "1.1 Implement BST playback",
      assertion: "Insert 9 and assert final SVG contains node 9."
    }
  ]);
});

test("planTestSop requires interaction evidence for visualizer changes", async () => {
  const root = await createFrontendFixture();

  const plan = await planTestSop(root, "polish");

  assert.equal(plan.changedPathSource, "verification");
  assert.deepEqual(plan.changedPaths, ["src/components/Visualizers/GraphView.tsx"]);
  assert(plan.required.some((check) => check.id === "frontend.interaction.visualizer"));
});

test("verifyTestEvidence rejects typecheck build and curl for visualizer behavior", async () => {
  const root = await createFrontendFixture();

  const result = await verifyTestEvidence(root, "polish");

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Missing structured evidence.*frontend\.runtime/u);
  assert.match(result.failures.join("\n"), /Missing structured evidence.*frontend\.interaction\.visualizer/u);
  assert.equal(result.warnings.includes("Weak frontend evidence observed but not accepted for interaction checks"), true);
});

test("verifyTestEvidence rejects behavior evidence until global test context is documented", async () => {
  const root = await createFrontendFixture();
  await writeProjectFile(root, "openspec/changes/polish/test-evidence.json", JSON.stringify({
    version: 1,
    checks: [
      {
        id: "frontend.runtime",
        status: "passed",
        command: "npm run dev",
        exitCode: 0,
        flow: "dev-server",
        assertions: ["GET / returned the app shell after dev server startup"]
      },
      {
        id: "frontend.interaction.visualizer",
        status: "passed",
        command: "npm run test:e2e -- graph-view",
        exitCode: 0,
        flow: "bst-playback",
        assertions: [
          "visible SVG node count is seven for default BST",
          "inorder traversal highlights nodes in expected order",
          "insert playback shows inserted node after completion"
        ]
      }
    ]
  }, null, 2));

  const result = await verifyTestEvidence(root, "polish");

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Global test context must exist/u);
});

test("verifyTestEvidence accepts structured runtime and interaction assertions with confirmed test context", async () => {
  const root = await createFrontendFixture();
  await writeDocumentedFrontendTestContext(root);
  await writeProjectFile(root, "openspec/changes/polish/test-evidence.json", JSON.stringify({
    version: 1,
    checks: [
      {
        id: "frontend.runtime",
        status: "passed",
        command: "npm run dev",
        exitCode: 0,
        flow: "dev-server",
        assertions: ["GET / returned the app shell after dev server startup"]
      },
      {
        id: "frontend.interaction.visualizer",
        status: "passed",
        command: "npm run test:e2e -- graph-view",
        exitCode: 0,
        flow: "bst-playback",
        assertions: [
          "visible SVG node count is seven for default BST",
          "inorder traversal highlights nodes in expected order",
          "insert playback shows inserted node after completion"
        ]
      }
    ]
  }, null, 2));

  const result = await verifyTestEvidence(root, "polish");

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test("verifyTestEvidence requires structured assertions for task-level tests", async () => {
  const root = await createFrontendFixture();
  await writeDocumentedFrontendTestContext(root);
  await writeProjectFile(root, "openspec/changes/polish/tasks.md", `- [x] 1.1 Polish graph visualizer
  - Test: Select inorder traversal and assert highlighted values are 2,3,4,5,6,7,8.
  - Test: Insert 9 and assert final SVG contains node 9.
  - Evidence: npm run test:e2e -- graph-view passed
`);
  await writeProjectFile(root, "openspec/changes/polish/test-evidence.json", JSON.stringify({
    version: 1,
    checks: [
      {
        id: "frontend.runtime",
        status: "passed",
        command: "npm run dev",
        exitCode: 0,
        flow: "dev-server",
        assertions: ["GET / returned the app shell after dev server startup"]
      },
      {
        id: "frontend.interaction.visualizer",
        status: "passed",
        command: "npm run test:e2e -- graph-view",
        exitCode: 0,
        flow: "bst-playback",
        assertions: [
          "Select inorder traversal and assert highlighted values are 2,3,4,5,6,7,8."
        ]
      }
    ]
  }, null, 2));

  const result = await verifyTestEvidence(root, "polish");

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Insert 9 and assert final SVG contains node 9/u);
});

test("verifyTestEvidence accepts structured assertions covering task-level tests", async () => {
  const root = await createFrontendFixture();
  await writeDocumentedFrontendTestContext(root);
  await writeProjectFile(root, "openspec/changes/polish/tasks.md", `- [x] 1.1 Polish graph visualizer
  - Test: Select inorder traversal and assert highlighted values are 2,3,4,5,6,7,8.
  - Test: Insert 9 and assert final SVG contains node 9.
  - Evidence: npm run test:e2e -- graph-view passed
`);
  await writeProjectFile(root, "openspec/changes/polish/test-evidence.json", JSON.stringify({
    version: 1,
    checks: [
      {
        id: "frontend.runtime",
        status: "passed",
        command: "npm run dev",
        exitCode: 0,
        flow: "dev-server",
        assertions: ["GET / returned the app shell after dev server startup"]
      },
      {
        id: "frontend.interaction.visualizer",
        status: "passed",
        command: "npm run test:e2e -- graph-view",
        exitCode: 0,
        flow: "bst-playback",
        assertions: [
          "Select inorder traversal and assert highlighted values are 2,3,4,5,6,7,8.",
          "Insert 9 and assert final SVG contains node 9."
        ]
      }
    ]
  }, null, 2));

  const result = await verifyTestEvidence(root, "polish");

  assert.equal(result.ok, true);
});
