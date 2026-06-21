# Test Plan: build-opencode-harness-plugin

## Affected Surfaces

- OpenCode plugin runtime.
- OpenCode skills and command templates.
- OpenSpec Harness state machine and loop recommender.
- Documentation and hand-drawn SVG diagrams.

## Required Checks

- Run `npm run test` after state-machine, loop, plugin, or evidence logic changes.
- Run `npm run validate` before considering the change ready.
- Run `npm run test:opencode-headless` after packaging or OpenCode global-install behavior changes.
- Parse updated SVG diagrams to confirm they are valid XML.

## Frontend/Runtime Notes

This repository is not a frontend application. Browser-level verification is not
required for the harness package itself unless a future change adds a frontend
surface.

## Evidence To Record

- Commands run and their pass/fail result.
- Any headless OpenCode smoke-test result when plugin loading changes.
- Diagram parse results when SVG assets change.
