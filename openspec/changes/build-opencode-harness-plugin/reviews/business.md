Status: approved

## Scope

Business review for the OpenCode-first OpenSpec Harness plugin and workflow
model.

## Blocking Issues

None

## Non-blocking Concerns

- Real model-driven DeepSeek e2e is intentionally deferred until explicitly
  enabled to control cost and nondeterminism.

## Assumptions Accepted

- OpenSpec remains the lightweight source-of-truth layer.
- The harness supplies stronger governance without replacing OpenSpec.

## Required Follow-ups

- Add loop automation after hard gates are implemented and verified.

## Evidence Reviewed

- `docs/design.md`
- `opencode.json`
- `.opencode/skills/openspec-harness-*/SKILL.md`
- `npm run validate:all`
