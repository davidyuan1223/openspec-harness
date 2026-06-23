---
name: openspec-harness-doctor
description: Check OpenSpec Harness installation, command files, skills, package dependency, wrapper, and OpenCode runtime readiness.
license: MIT
compatibility: opencode
---

## Purpose

Use this to verify that OpenSpec Harness is installed and visible to OpenCode.

## Required Inputs

- Current project root.
- OpenCode global config directory when checking global installation.

## Preflight Checks

1. Prefer the internal install doctor when available.
2. For global checks, run `openspec-harness doctor --global --json` or call the
   equivalent internal tool if exposed by the runtime.
3. For project checks, inspect package metadata, plugin entry, command files,
   skills, and OpenSpec harness docs.
4. Do not print raw wrapper JSON, stdout, or stderr fields to the user.

## Required Checks

- OpenCode binary is available.
- OpenSpec Harness package dependency is installed in the OpenCode config dir.
- Plugin wrapper exists and imports the package.
- Plugin is registered in OpenCode config.
- `openspec-harness-*` skills are present.
- OMO-style command files are present under `command/`, or legacy config commands
  are present when using `--command-mode config`.
- Project docs mention the installed command mode.

## Output

Report:

- pass/fail,
- plugin registration,
- package dependency,
- command files vs legacy config commands,
- skills,
- OpenCode binary version,
- exact repair command when something is missing.

Keep output concise and user-facing.
