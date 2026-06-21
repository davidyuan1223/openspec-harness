---
name: openspec-harness-archive
description: Archive an OpenSpec change only after archive-mode harness gates and strict OpenSpec validation pass.
license: MIT
compatibility: opencode
---

## Purpose

Use this for the final state transition from verified change to archived spec.

## Required Inputs

- Change id.
- Passing archive-mode harness verification.
- Approved implementation review.
- Complete verification evidence.

## Preflight Checks

1. Run the internal verifier in archive mode.
2. Confirm no failed gates remain.
3. Confirm `openspec validate --all --strict --no-interactive` passes.
4. For frontend or fullstack user-visible changes, confirm runtime/browser
   behavior evidence is present and was accepted by verification.
5. Confirm `test.md` was executed or otherwise explicitly accepted during
   `/openspec-harness:verify`.

## Allowed Actions

- Run `openspec archive <change>` only after preflight passes.
- Run strict OpenSpec validation after archive.
- Report archived specs and any follow-up docs.

## Disallowed Actions

- Do not archive with missing constitution.
- Do not archive with malformed reviews.
- Do not bypass the plugin hook.
- Do not archive based only on completed task checkboxes.
- Do not archive frontend user-visible changes based only on typecheck, build,
  unit tests, or server-start claims.

## Exit Criteria

Archive is complete only when:

- archive command succeeds,
- strict validation passes,
- no active change remains for the archived id,
- updated specs are reported.

## Stop Conditions

Stop immediately if the verifier fails or the plugin blocks the archive command.

Do not mention internal runtime details in the final response. The user-facing
surface is `/openspec-harness:archive`.
