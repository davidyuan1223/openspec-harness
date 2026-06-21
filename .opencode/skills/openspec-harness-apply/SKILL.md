---
name: openspec-harness-apply
description: Implement an approved OpenSpec change one verifiable task slice at a time under constitution and review gates.
license: MIT
compatibility: opencode
---

## Purpose

Use this to implement an approved OpenSpec change without bypassing business and
design gates.

## Required Inputs

- `openspec/harness/constitution.md`.
- `openspec/harness/test-context.md`.
- `proposal.md`.
- `test.md`.
- `tasks.md`.
- `reviews/business.md` with `Status: approved`.
- `reviews/design.md` with `Status: approved` when `design.md` exists.
- `reviews/test.md` with `Status: approved`.
- Relevant specs.

## Preflight Checks

1. Run or request the internal apply verifier.
2. Derive the validation required for the current task slice from proposal,
   tasks, changed files, and project test surface.
3. Confirm constitution exists and is consistent with the change.
4. Confirm business review is approved.
5. Confirm design review is approved when design exists.
6. Confirm test review is approved.
7. Identify the next single task slice and the `Test:` lines it affects.

Use the internal verifier as the source of truth for apply blockers. Do not
invent additional blockers from prose if the verifier did not report them.
`design.md` is optional; require design review only when `design.md` exists.
`evidence.md` is an archive gate and does not need to exist before starting
apply work.
Do not mention internal runtime details in the final response. The user-facing
surface is `/openspec-harness:apply`.

## Allowed Actions

- Edit implementation files for the current task slice.
- Add or update tests for the current task slice.
- Run focused checks that keep the implementation loop honest.
- Add enough instrumentation, tests, or hooks for verify to exercise `test.md`.
- Mark a task complete only after validation.
- Add a concrete `Evidence:` line under each completed task.
- Record implementation evidence, but leave final change-level verification to
  `/openspec-harness:verify`.

## Disallowed Actions

- Do not archive.
- Do not approve your own review artifacts.
- Do not mark multiple unrelated tasks complete in one step.
- Do not treat passing unit tests as business approval.
- Do not claim frontend or fullstack user-visible behavior is done from
  typecheck, unit tests, or build alone.

## Frontend Implementation Rule

For frontend or fullstack user-visible changes, apply must not claim final user
functionality from code-level checks alone. It may run focused checks while
implementing, but final running-app browser verification belongs to
`/openspec-harness:verify`.

Apply should leave enough evidence and test hooks for verify to run the plan:

- changed files,
- implemented controls or flows,
- focused checks already run,
- known gaps that verify still needs to exercise.

## Exit Criteria

Stop after each coherent task slice with:

- changed files summarized,
- validation commands and results recorded,
- task-level `Test:` cases mapped to implementation evidence,
- `tasks.md` updated with `Evidence:`,
- remaining tasks listed.

## Stop Conditions

Stop before editing if any required review is missing, rejected, malformed, or
not backed by evidence.

Stop before claiming the whole change verified. Apply can complete implementation
tasks, but `/openspec-harness:verify` is responsible for executing `test.md` and
accepting final test evidence.
