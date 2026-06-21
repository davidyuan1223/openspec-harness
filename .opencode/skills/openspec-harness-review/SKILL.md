---
name: openspec-harness-review
description: Perform structured adversarial business, design, or implementation review with machine-checkable review artifacts.
license: MIT
compatibility: opencode
---

## Purpose

Use this to reduce rework caused by shallow business understanding or
implementation drift. The default reviewer stance is skeptical: assume the maker
missed something important and try to falsify the proposal or implementation.

## Required Inputs

- `openspec/harness/constitution.md`.
- `openspec/harness/test-context.md`.
- Change `proposal.md`.
- Change `design.md` when present.
- Change `test.md`.
- Change `tasks.md`.
- Relevant specs.
- Implementation diff and test output for implementation review.
- Runtime evidence and `test-evidence.json` for implementation review when
  behavior-level gates apply.

## Review Modes

- `business`: challenge actors, workflows, hidden states, permissions,
  acceptance criteria, and edge cases.
- `design`: verify the technical plan maps to business scenarios and state
  transitions.
- `test`: verify the change-level test plan is credible for the project context
  and the changed behavior.
- `implementation`: verify code, tests, and evidence match proposal, design,
  constitution, specs, and the validation required by the changed surface.

## Required Artifact Format

Write exactly one of:

- `openspec/changes/<change>/reviews/business.md`
- `openspec/changes/<change>/reviews/design.md`
- `openspec/changes/<change>/reviews/test.md`
- `openspec/changes/<change>/reviews/implementation.md`

The artifact must contain these headings:

```text
Status: approved

## Scope
## Blocking Issues
## Non-blocking Concerns
## Assumptions Accepted
## Required Follow-ups
## Evidence Reviewed
```

Use `Status: rejected` instead of `Status: approved` when blocking issues exist.

## Approval Rules

Approve only if:

- Blocking Issues says `None`.
- Evidence Reviewed lists concrete files, commands, outputs, or review inputs.
- Assumptions Accepted are explicit and bounded.
- Required validation checks are satisfied.
- Behavior-level evidence is structured and machine-checkable, not only prose.

For `test` review, approve only if `test.md` explains how this specific change
will be verified using the project's `test-context.md`. It must reject plans
that only say "run tests" without startup steps, user flows, or evidence
expectations for changed behavior.

## Frontend Review Rule

For frontend or fullstack user-visible changes, reject implementation review
unless the evidence proves the running application was exercised. Acceptable
evidence must include a dev or preview server command, opened URL, user actions,
and assertions against visible DOM/canvas/SVG/text/control state. Typecheck,
build, jsdom-only unit tests, and "server started" claims are not enough.

## Stop Conditions

Reject if:

- Business acceptance cannot be tested.
- Design omits a required state transition, data migration, permission, or
  rollback concern.
- Test plan omits the project startup context, changed user flows, or concrete
  evidence expectations.
- Implementation evidence is missing, self-referential, or only says the agent
  believes it is done.
- Frontend interaction/API runtime/CLI runtime/fullstack behavior changed but
  `test-evidence.json` is missing required passed checks and assertions.
- Frontend evidence does not show that the application was started and exercised
  through browser-level behavior.
