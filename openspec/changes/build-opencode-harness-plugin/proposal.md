## Why

OpenCode can run coding agents with commands, plugins, tools, hooks, and a
headless server. OpenSpec Harness needs an OpenCode-first implementation that
uses those extension points to enforce spec-driven development instead of only
prompting the model to follow it.

## What Changes

- Add namespaced OpenCode commands for OpenSpec Harness workflows.
- Add a file-backed state machine for OpenSpec change phases.
- Add OpenCode plugin hooks and tools for status, verification, and archive
  gating.
- Add adversarial review artifacts for business, design, and implementation
  gates.

## Impact

- OpenCode users can invoke `/openspec-harness:*` commands.
- Archive attempts are blocked unless OpenSpec Harness gates pass.
- Future loop automation can build on a verified state machine.
