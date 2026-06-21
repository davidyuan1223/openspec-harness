---
name: openspec-harness-loop
description: Run one safe OpenSpec Harness loop step by recommending the next legal action from the current state machine.
license: MIT
compatibility: opencode
---

## Purpose

Use this to move from manual phase switching toward controlled loop execution.
The loop is intentionally single-step, gate-aware, and conservative.

## Required Inputs

- Change id.
- Current OpenSpec Harness state.
- Constitution and review artifacts.
- `test-context.md`, `test.md`, and test review artifacts.

## Preflight Checks

1. Use the internal loop recommender as the source of truth.
2. Prefer the internal test-plan helper before recommending implementation or review.
3. Do not run shell commands for loop status unless the user explicitly asks for CLI output.
4. Use `execute=false` by default.
5. Use `execute=true` only for mechanical actions.
6. Use `allowArchive=true` only when the user explicitly wants archive execution.

## Gate Interpretation

- Do not invent blockers that are not reported by the internal loop recommender
  or verifier.
- `design.md` is optional. A design review is required only when `design.md`
  exists for the change.
- `test-context.md` is global project testing context and must exist before
  proposal is considered ready.
- `test.md` is required for each change and must be test-reviewed before apply.
- `evidence.md` is required before archive, not before starting apply.
- The normal order is explore/propose, business review, optional design review,
  test review, apply, verify, implementation review, archive. Do not reverse
  explore and propose.

## Allowed Actions

- Recommend the next legal command.
- Execute mechanical actions when explicitly requested.
- Report blocked gates.
- Report missing validation evidence when archive would fail.
- Run verifier checks.
- Continue to apply/review only when the recommendation says it is legal.

## Automatic Execution Boundary

The loop may execute archive only with both `execute=true` and
`allowArchive=true`. It must not automatically write implementation code,
approve reviews, or invent evidence.

## Exit Criteria

Output:

- current state,
- recommended next action,
- exact command,
- blocked reasons,
- validation evidence status,
- whether human review is required.
- whether anything was executed.

Do not mention internal runtime details in the final response. The user-facing
surface is `/openspec-harness:loop`.

## Stop Conditions

Stop if the loop recommendation is blocked. Fix the listed gates before
continuing.
