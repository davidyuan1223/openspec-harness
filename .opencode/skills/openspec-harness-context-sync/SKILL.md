---
name: openspec-harness-context-sync
description: Realign project context after user corrections, requirement changes, or implementation drift without forcing a full OpenSpec restart by default.
license: MIT
compatibility: opencode
---

## Purpose

Use this when the user corrects the agent's interpretation, changes the target,
or says the implementation, tests, or documents no longer match the intended
direction.

The goal is not to restrict the agent. The goal is to prevent stale assumptions
from continuing invisibly after the user has clarified intent.

## Required Inputs

- Latest user feedback or correction.
- `openspec/harness/context.md` when present.
- `openspec/harness/decision-log.md` when present.
- Active OpenSpec change artifacts when a change is affected.
- Relevant implementation or README/design docs when the correction mentions
  them.

## Preflight Checks

1. Call the internal `openspec_harness_context_sync` tool when available, with
   `write=false`, before making a final classification.
2. Use the tool result as the baseline classification. You may refine the
   explanation after reading project files, but do not ignore the structured
   result.
3. If context files should be updated, either call
   `openspec_harness_context_sync` again with `write=true` or manually write a
   richer `context.md` / `decision-log.md` that preserves the same
   classification and impact level.
4. Classify the feedback impact:
   - Level 1: clarification or wording correction.
   - Level 2: requirement or verification clarification.
   - Level 3: target pivot that may require proposal/design/test updates.
   - Level 4: implementation contradiction that requires correction flow.
5. Separate user-stated facts from agent assumptions.
6. Do not keep applying the old plan if the correction changes the target.

## Allowed Actions

- Update `openspec/harness/context.md`.
- Append a decision entry to `openspec/harness/decision-log.md`.
- Recommend whether the active change can continue, must update proposal/test
  docs, or should restart from propose/design.
- Ask concise clarification only when the correction cannot be classified.

Do not edit implementation files as part of context sync.
Do not approve reviews or invent evidence.

## Output

Report:

- interpreted correction,
- impact level,
- affected context facts,
- whether current OpenSpec change artifacts need updates,
- next safe user-facing command.

## Stop Conditions

Stop before continuing implementation if:

- the user correction contradicts the active proposal,
- test expectations changed but `test.md` has not been updated,
- the implementation already written appears to satisfy the old intent rather
  than the corrected one.
