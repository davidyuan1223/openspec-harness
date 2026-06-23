---
description: Implement an approved OpenSpec change
argument-hint: "<change>"
---

Load and follow the skill `openspec-harness-apply` for: $ARGUMENTS

Before editing, run the internal apply gate and use its result as the source of
truth. Inspect `proposal.md`, `design.md` if present, `test.md`, `tasks.md`,
review artifacts, and relevant specs. `design.md` is optional; `evidence.md` is
an archive gate, not an apply prerequisite. Implement one coherent task slice at
a time and record implementation evidence. Final test execution belongs to
`/openspec-harness-verify`.
