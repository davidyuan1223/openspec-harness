# OpenSpec Harness Constitution

## Purpose

This constitution defines non-negotiable rules for OpenSpec Harness workflows.
OpenSpec remains lightweight and iterative; the harness supplies governance,
verification, and stop conditions.

## Operating Principles

1. Business understanding precedes implementation.
2. Reviews are state transitions, not afterthoughts.
3. A completed task without evidence is not complete.
4. A passing test is useful evidence, not proof of business correctness.
5. Archive is a final state transition and must be machine-gated.

## Required Artifacts

Every implemented change must have:

- `proposal.md`
- `tasks.md`
- delta specs for user-visible behavior
- `reviews/business.md`
- `reviews/design.md` when `design.md` exists
- `reviews/implementation.md` before archive
- `evidence.md` before archive

## Review Artifact Standard

Each review artifact must contain:

```text
Status: approved

## Scope
## Blocking Issues
## Non-blocking Concerns
## Assumptions Accepted
## Required Follow-ups
## Evidence Reviewed
```

Use `Status: rejected` when blocking issues exist.

Approval is valid only when `## Blocking Issues` says `None` and
`## Evidence Reviewed` contains concrete files, commands, outputs, or review
inputs.

## Evidence Standard

Evidence must name concrete verification:

- command and result,
- test name or suite,
- reviewed file or diff,
- generated artifact,
- runtime/API/browser check,
- explicit accepted assumption.

Evidence cannot be only "implemented", "looks good", or "agent verified".

## Phase Gates

Apply mode requires:

- constitution present,
- proposal present,
- tasks present,
- business review approved and valid,
- design review approved and valid when design exists.

Archive mode additionally requires:

- all tasks complete,
- every completed task has evidence,
- implementation review approved and valid,
- `evidence.md` present,
- strict OpenSpec validation passes.

## Prohibited Shortcuts

- Do not implement before business review approval.
- Do not archive without implementation review approval.
- Do not approve your own work without evidence.
- Do not hide unresolved business questions in technical tasks.
- Do not treat OpenSpec validation as a substitute for domain review.
