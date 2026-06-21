Status: approved

## Scope

Design review for OpenCode commands, skills, plugin tools, hook gates, and
OpenSpec Harness state machine.

## Blocking Issues

None

## Non-blocking Concerns

- Loop automation should remain advisory until enough gate coverage exists.

## Assumptions Accepted

- OpenCode command names can use `openspec-harness:*`.
- OpenCode skill names cannot use colons, so skills use
  `openspec-harness-*`.

## Required Follow-ups

- Add apply command interception in the plugin.
- Add loop status/next-action support.

## Evidence Reviewed

- `lib/state-machine.js`
- `lib/opencode-plugin-core.js`
- `.opencode/plugins/openspec-harness.ts`
- `scripts/check-opencode-headless.mjs`
- `npm run validate:all`
