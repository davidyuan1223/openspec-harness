# Test Context

## Project Type

This repository is a Node.js package that provides an OpenCode plugin, OpenCode
skills, CLI helpers, and OpenSpec Harness state-machine logic.

## Environment

- Runtime: Node.js.
- Package manager: npm.
- OpenSpec CLI must be available for strict spec validation.
- OpenCode is required only for headless/plugin smoke tests.

## Standard Checks

- Unit tests: `npm run test`
- OpenCode fixture validation: `npm run validate:opencode`
- OpenSpec strict validation: `npm run validate:openspec`
- Full local validation: `npm run validate`
- Optional OpenCode headless smoke test: `npm run test:opencode-headless`

## Evidence Expectations

For state-machine, loop, CLI, and plugin changes, evidence should include the
relevant unit tests and `npm run validate`.

For OpenCode integration changes, evidence should also include fixture
validation or headless OpenCode smoke testing when practical.

For documentation or diagram-only changes, evidence should include static file
inspection and XML/SVG parse checks when diagrams are touched.
