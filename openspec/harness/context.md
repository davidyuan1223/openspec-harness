# Project Context

## Purpose

OpenSpec Harness is a context-aware agent harness for OpenCode. Its primary goal
is to help the agent keep user intent, project facts, test reality, and
implementation evidence aligned while using OpenSpec as the change artifact
engine.

## Current Understanding

- The harness should help the model do better work, not merely restrict it.
- Hard gates are reserved for high-risk transitions such as implementation
  writes and archive.
- Context, test planning, and documentation sync should mostly improve
  confidence, expose drift, and recommend the next reliable action.
- User corrections can happen at any phase and should trigger context
  realignment before continuing stale assumptions.

## User Preferences

- Prefer runnable systems, concrete validation, and real integration evidence
  over document-only claims.
- For frontend-visible changes, verification should exercise the running app
  and browser-level behavior when practical.
- Tools are for the agent; user-facing operations should remain skills and
  commands.
- When implementation and user intent diverge, update context and affected
  artifacts before continuing implementation.

## Common Drift Risks

- Treating build/typecheck as proof of frontend behavior.
- Continuing an old proposal after the user corrected the intended outcome.
- Letting README/design/context docs drift from actual plugin tools, skills,
  hooks, package metadata, and release state.
- Treating OpenSpec change documents as the only source of project context.

## Context Documents

- `context.md`: long-lived user intent, project facts, preferences, and drift
  risks.
- `test-context.md`: stable project startup, environment, test commands, and
  trusted evidence expectations.
- `decision-log.md`: append-only record of major user corrections and context
  realignment decisions.

- 2026-06-21T20:24:54.543Z: realign-change. 不是限制模型必须怎么做，而是帮助模型更好完成工作