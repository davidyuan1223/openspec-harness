---
description: Show current OpenSpec Harness state
argument-hint: "[change]"
---

Load and follow the skill `openspec-harness-status` for: $ARGUMENTS

Run the internal status check. Do not run shell commands for status unless the
user explicitly asks for CLI output. Summarize active changes, inferred state,
missing artifacts, incomplete tasks, review gates, and next legal transitions.
Do not invent blockers beyond verifier results. Do not print raw JSON, stdout,
stderr wrapper fields, or internal runtime details.
