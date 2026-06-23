---
description: Realign project context after user feedback or requirement drift
argument-hint: "<feedback>"
---

Load and follow the skill `openspec-harness-context-sync` for: $ARGUMENTS

First call the internal `openspec_harness_context_sync` tool with write=false
when available, then use its classification as the baseline. Update
context-level documents when appropriate, and recommend whether the active
OpenSpec change can continue or must update proposal/design/test artifacts. Do
not edit implementation files during context sync.
