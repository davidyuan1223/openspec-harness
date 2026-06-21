---
name: openspec-harness-propose
description: Create OpenSpec proposal artifacts under strict preflight, constitution, scenario, and review-readiness rules.
license: MIT
compatibility: opencode
---

## Purpose

Use this to prepare an OpenSpec change after exploration. The output must be
reviewable by business and design reviewers before implementation starts.

## Required Inputs

- Exploration notes or user request.
- `openspec/harness/constitution.md`.
- `openspec/harness/test-context.md`.
- Existing specs under `openspec/specs/` when present.
- Active changes under `openspec/changes/`.

## Preflight Checks

1. Confirm no active change already covers the same intent.
2. Read the constitution and quote any relevant constraints in your reasoning.
3. Read `test-context.md` and infer the current change's testing surface.
4. Ask the user only for unresolved testing assumptions that materially affect
   the proposal. Do not ask the user to run a separate testing workflow.
5. Identify whether `design.md` is required.
6. Identify required review artifacts before implementation.

## Allowed Actions

- Create or update `proposal.md`.
- Create or update `design.md` when architecture, data, permissions, integration,
  migration, or state transitions are affected.
- Create or update `tasks.md`.
- Create or update `test.md`.
- Create or update delta specs.

Do not edit implementation files.
Do not mark review artifacts approved.

## Required Proposal Content

`proposal.md` must cover:

- Why
- What changes
- Non-goals
- Business scenarios
- Acceptance criteria
- Validation signals
- Risk register

## Required Task Rules

Tasks must be small enough to verify independently and must leave room for
`Evidence:` lines after implementation.

Functional test cases belong in `tasks.md`. Add `Test:` lines under the task
that owns the behavior, for example:

```text
- [ ] 1.2 Implement checkout validation
  - Test: Submit an expired card and assert the API returns CARD_EXPIRED.
  - Test: Submit a valid card and assert the receipt total includes tax.
```

Do not hide feature-specific test expectations only in prose. The apply,
review, and verify phases use these `Test:` lines to decide what evidence is
required.

## Required Test Plan Content

`test.md` is the change-level test plan. It must be based on `test-context.md`
and the current change, not on generic best practices.

It should include:

- affected surfaces,
- startup or environment prerequisites,
- exact checks expected during verify,
- frontend/browser flows when user-visible UI changes,
- backend/API/CLI flows when those surfaces change,
- evidence that would be sufficient,
- open testing questions that require user confirmation.

## Validation Responsibility

Proposal owns the first validation plan. It should translate the rough user
request into `test.md`, task-level `Test:` lines, and validation signals without
pretending the evidence already exists.

For frontend or fullstack systems, proposal must mark user-visible behavior as
requiring runtime/browser verification later. Typecheck, unit tests, and build
may be listed as readiness checks, but they must not be described as sufficient
proof that the user-facing system works.

## Exit Criteria

Proposal is ready only when:

- `proposal.md` exists.
- `tasks.md` exists.
- `test.md` exists.
- implementation tasks include concrete `Test:` lines for changed behavior.
- Delta specs exist for user-visible behavior.
- `design.md` exists when required.
- Business review and design review are still pending, not bypassed.

## Stop Conditions

Stop if:

- Constitution constraints are missing or unread.
- Business scenarios are too vague to test.
- A required design decision is hidden inside tasks instead of `design.md`.

Do not mention internal runtime details in the final response. The user-facing
surface is `/openspec-harness:propose`.
