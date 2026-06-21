---
name: openspec-harness-verify
description: Verify OpenSpec Harness gates with constitution, review format, task evidence, and OpenSpec strict validation.
license: MIT
compatibility: opencode
---

## Purpose

Use this to turn "looks done" into machine-checkable evidence.

## Required Inputs

- Change id.
- `openspec/harness/constitution.md`.
- `openspec/harness/test-context.md`.
- Change artifacts.
- `test.md`.
- Review artifacts.
- Test and validation outputs.

## Preflight Checks

1. Prefer the internal harness verifier.
2. Prefer the internal behavior-evidence verifier when runtime or interaction
   behavior may have changed.
3. Otherwise run `node ./bin/openspec-harness.mjs verify --change <change> --mode archive`.
4. Use `--mode apply` for pre-implementation checks.
5. Read `test-context.md`, `test.md`, and `tasks.md` before deciding what to run.

## Required Gates

- Constitution exists.
- Proposal exists.
- Test plan exists.
- Tasks exist.
- Business review is approved and well-formed.
- Design review is approved and well-formed when design exists.
- Test review is approved and well-formed.
- Every completed task has concrete evidence.
- Implementation review is approved and well-formed before archive.
- `evidence.md` exists before archive.
- Behavior evidence passes before archive when high-confidence behavior surfaces changed.
- `openspec validate --all --strict --no-interactive` passes.

## Frontend Verification Rule

For frontend or fullstack user-visible changes, verification must fail unless
there is structured evidence that the actual application was started and
exercised. Required proof includes server command, URL, browser-capable runner
or manual browser transcript, user actions, and assertions against visible
DOM/canvas/SVG/text/control state.

Do not accept these as sufficient frontend functionality proof:

- typecheck,
- build,
- lint,
- jsdom-only unit tests,
- `curl localhost`,
- "dev server starts",
- prose saying the UI was inspected.

## Verification Responsibility

Verify is the testing phase. It must execute or inspect the checks described in
`test.md`, not merely trust evidence written during apply. When a check cannot
be executed because the environment is unavailable, report the exact blocker and
ask the user for the missing environment detail instead of marking it passed.

For frontend changes, verify should start the app or preview build, open the
local URL, exercise the user flow, and record visible assertions. For backend,
CLI, or integration changes, verify should follow the equivalent startup and
runtime flow from `test-context.md`.

## Output

Report:

- overall pass/fail,
- failed gates,
- missing or weak runtime/behavior evidence,
- next legal transition,
- exact files or commands needed to fix failures.

Do not mention internal runtime details in the final response. The user-facing
surface is `/openspec-harness:verify`.

## Stop Conditions

Do not say verification passed if any evidence is indirect, missing, or only
based on the agent's assertion.

Do not treat code-level tests as sufficient evidence for changed frontend
interaction, visualizer, SVG/canvas, API runtime, CLI runtime, or fullstack
workflow behavior.
