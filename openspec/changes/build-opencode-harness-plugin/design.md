## Overview

The plugin separates guidance from enforcement:

- OpenCode commands provide human-facing workflow prompts.
- Custom tools provide structured operations the agent can call.
- Hooks enforce non-bypassable gates for risky transitions.
- The state machine infers phase from OpenSpec files and review artifacts.

## State Source

State is inferred from files under `openspec/changes/<change>`:

- `proposal.md`
- `design.md`
- `tasks.md`
- `reviews/business.md`
- `reviews/design.md`
- `reviews/implementation.md`
- `evidence.md`

## OpenCode Extension Points

The project plugin uses:

- `tool.execute.before` to block `openspec archive <change>` when gates fail.
- `experimental.chat.system.transform` to inject current OpenSpec state.
- custom tools for status and verification.

## Review Model

Adversarial review is required before implementation and archive:

- Business review checks assumptions, actors, scenarios, and acceptance risks.
- Design review checks whether the implementation plan covers real workflows.
- Implementation review checks code, tests, and evidence against the proposal.
