# Test Context Design

OpenSpec Harness does not model testing as a rigid JSON SOP that users must run
as a separate workflow. Testing is split into two authoring artifacts and one
execution phase:

- `openspec/harness/test-context.md` describes the stable project testing
  context: how to install, start, seed, log in, reset data, and verify each
  runtime surface.
- `openspec/changes/<change>/test.md` describes the current change's concrete
  test plan: affected surfaces, user flows, commands, runtime checks, and
  evidence expectations.
- `/openspec-harness:verify` executes or inspects that plan and records whether
  evidence is credible.

## Why Context Instead Of JSON

Real projects vary too much for a static schema to be the source of truth. A
frontend project may require a dev server, seeded auth state, browser
interaction, screenshots, and accessibility checks. A backend project may
require databases, queues, migrations, service containers, or API clients. A CLI
project may require filesystem fixtures and terminal output assertions.

The useful invariant is not "every repo fits one schema." The useful invariant
is "the model cannot claim verification without explaining how this project is
started and how this change is actually exercised."

## Phase Responsibilities

`explore` owns global testing context discovery. If `test-context.md` is missing,
it drafts one from the repository and asks the user only for environment details
that cannot be inferred safely.

`propose` owns per-change testing design. It translates the rough request and
global context into `test.md` plus task-level `Test:` lines in `tasks.md`.

`review test` owns test-plan credibility. It rejects generic plans, missing
runtime startup steps, missing frontend browser behavior checks, or evidence that
cannot prove the changed behavior.

`apply` owns implementation. It may add tests or instrumentation, but it does not
declare final verification complete.

`verify` owns execution. It follows `test-context.md` and `test.md`, starts the
necessary environment, performs the checks, and records accepted or missing
evidence.

## Frontend Rule

For frontend-visible changes, code-level checks are not enough. Verification must
exercise the running app through browser-level behavior and include concrete
evidence such as the URL, actions performed, assertions made, screenshots,
traces, or relevant logs.

`typecheck`, `build`, `lint`, unit tests, and `curl localhost` can support the
case, but they cannot alone prove that a visual or interactive frontend change
works.
