---
name: openspec-harness-explore
description: Run a strict pre-proposal exploration protocol for business context, scenarios, assumptions, risks, and validation signals.
license: MIT
compatibility: opencode
---

## Purpose

Use this before creating or changing OpenSpec artifacts. The goal is to prevent
the agent from producing a plausible proposal from shallow business
understanding.

## Required Inputs

- User request or issue.
- Existing project docs and nearby implementation context.
- `openspec/harness/constitution.md` if present.
- `openspec/harness/test-context.md` if present.
- Existing OpenSpec specs and active changes.

## Preflight Checks

1. Inspect current OpenSpec status.
2. Read the constitution before making recommendations.
3. Check whether `openspec/harness/test-context.md` exists.
4. If it is missing, inspect the project enough to draft it before finalizing
   exploration.
5. Identify whether the request is business behavior, technical cleanup, or both.
6. Separate facts from assumptions.

## Allowed Actions

- Read files and docs.
- Ask or record clarifying questions.
- Create or update `openspec/harness/test-context.md`.
- Produce exploration notes.
- Recommend whether a proposal is ready.

Do not edit implementation files.
Do not create tasks before the core business scenarios are clear.

## Required Output

Return these sections:

- Business scenarios
- Actors and roles
- State transitions
- Permissions and policy constraints
- Edge cases and failure modes
- Known facts
- Assumptions
- Open questions
- Acceptance risks
- Suggested verification signals

## Validation Responsibility

Exploration owns the global testing context. `test-context.md` should describe
how this project is normally started and tested, including environment setup,
dev server or backend startup, test commands, manual prerequisites, and which
evidence is trustworthy for user-visible behavior.

Exploration also identifies the current change's likely validation risks, but
it must not finalize the change-level test plan. For frontend or fullstack
requests, explicitly note whether the expected outcome is user-visible and
would need real application startup plus browser-level interaction checks later.

## Exit Criteria

Exploration is complete only when high-risk open questions are resolved or
explicitly accepted as assumptions.

## Stop Conditions

Stop before propose if:

- A core actor or workflow is unknown.
- Required permissions or data ownership are unclear.
- Acceptance criteria cannot be tested.
- `test-context.md` is missing and the project testing environment has not been
  inspected enough to draft it.
- The request conflicts with the constitution.
