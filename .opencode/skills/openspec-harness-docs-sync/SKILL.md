---
name: openspec-harness-docs-sync
description: Check and maintain alignment between context-level documents, README/design docs, OpenCode commands, skills, tools, and package metadata.
license: MIT
compatibility: opencode
---

## Purpose

Use this after plugin behavior changes, before publishing, or when the user asks
whether docs and implementation are aligned.

This skill covers context-level documentation, not OpenSpec change proposal
artifacts. It checks that long-lived docs still describe the actual plugin.

## Required Inputs

- `README.md`
- `docs/design.md`
- `opencode.json`
- `.opencode/skills/*/SKILL.md`
- `lib/opencode-plugin.js`
- `package.json`
- `openspec/harness/context.md`
- `openspec/harness/test-context.md`

## Preflight Checks

1. Call the internal `openspec_harness_docs_sync` tool when available before
   making a final pass/fail judgment.
2. Use the tool result as the baseline list of command/skill/context findings.
   You may add human review findings, but do not suppress tool findings without
   explaining why they are false positives.
3. Confirm each `/openspec-harness:<command>` has a matching skill when the
   command loads a skill.
4. Confirm new skills/tools are mentioned in README or design docs when they
   are part of the public workflow.
5. Confirm package version and install docs do not contradict current metadata.
6. Confirm context docs describe stable project intent, not one-off change
   implementation details.

## Allowed Actions

- Update context-level docs.
- Update README/design descriptions of public workflow surfaces.
- Update skill docs when command/tool behavior changes.
- Report stale docs and exact files to fix.

Do not edit implementation files unless the user explicitly asks docs-sync to
repair a broken command/skill mismatch.

## Output

Report:

- pass/fail,
- stale or missing docs,
- command/skill/tool mismatches,
- package metadata mismatches,
- exact docs updated or recommended.

## Stop Conditions

Stop before publishing if docs-sync reports command/skill mismatches, missing
context docs, or README instructions that contradict the package metadata.
