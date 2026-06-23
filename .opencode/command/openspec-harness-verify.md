---
description: Verify an OpenSpec change against harness gates
argument-hint: "<change>"
---

Load and follow the skill `openspec-harness-verify` for: $ARGUMENTS

Run the internal verifier and execute or inspect the checks in `test.md` using
`test-context.md`. Report missing evidence, failed reviews, failed validation,
and exact next actions. For frontend-visible changes, verification must require
running-app browser behavior evidence. Do not expose internal runtime details to
the user.
