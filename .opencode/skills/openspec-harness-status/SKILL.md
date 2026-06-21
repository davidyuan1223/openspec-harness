---
name: openspec-harness-status
description: Inspect active OpenSpec changes, constitution readiness, inferred state, review gates, tasks, evidence, and next legal actions.
license: MIT
compatibility: opencode
---

## Purpose

Use this to orient before changing phase or choosing the next action.

## Required Inputs

- Current project root.
- OpenSpec changes and specs.
- `openspec/harness/constitution.md`.
- `openspec/harness/test-context.md`.

## Preflight Checks

1. Run the internal harness status check.
2. Do not run shell commands for status unless the user explicitly asks for CLI output.
3. If the internal check is unavailable, say that Harness status is unavailable and ask the user to reload OpenCode.
4. Do not show raw call JSON, shell wrapper JSON, `stdout`, or `stderr` fields to the user.
5. Do not infer extra blockers beyond the state machine and verifier results.

## Required Output

Summarize:

- constitution present or missing,
- test context present or missing,
- active changes,
- inferred state,
- review status and format validity,
- completed and incomplete task counts,
- missing evidence,
- runtime or behavior evidence gaps when they are obvious,
- next legal transition,
- blocked transitions and reasons.

Keep the response concise and human-readable. Convert command output into a
short status summary instead of pasting raw JSON.
Do not mention internal runtime details; the user-facing surface is the
`/openspec-harness:status` workflow.

`design.md` is optional and only triggers a design-review gate when present.
`evidence.md` is an archive gate, not a prerequisite for beginning apply.

## Stop Conditions

Do not recommend apply or archive if the matching verifier mode would fail.
