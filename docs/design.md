# Design

## Goal

Build an OpenCode-first OpenSpec Harness. OpenCode is the runtime, OpenSpec is
the state machine, and the plugin is the enforcement layer.

## Layers

| Layer | Responsibility |
| --- | --- |
| Command | Human-facing workflow entrypoints such as `/openspec-harness:propose`. |
| Tool | Structured operations the agent can call explicitly. |
| Hook | Non-bypassable gates around risky actions. |
| State machine | File-backed source of truth for legal phase transitions. |
| Loop | Future automation that repeatedly advances the state machine. |

## State Machine

```text
idle
  -> exploring
  -> proposed
  -> proposal_reviewed
  -> design_reviewed
  -> applying
  -> implementation_reviewed
  -> verified
  -> archived
```

The first implementation infers state from OpenSpec files:

```text
openspec/harness/constitution.md
openspec/harness/test-context.md
openspec/changes/<change>/proposal.md
openspec/changes/<change>/design.md
openspec/changes/<change>/test.md
openspec/changes/<change>/tasks.md
openspec/changes/<change>/reviews/business.md
openspec/changes/<change>/reviews/design.md
openspec/changes/<change>/reviews/test.md
openspec/changes/<change>/reviews/implementation.md
openspec/changes/<change>/evidence.md
```

## Review Gates

Adversarial review is a first-class state transition, not a post-code nicety.

| Gate | Purpose |
| --- | --- |
| Business review | Detect wrong assumptions, missing actors, hidden workflows, weak acceptance criteria. |
| Design review | Verify the technical design maps to real business scenarios and state transitions. |
| Test review | Verify `test.md` is credible for the global `test-context.md` and the current change. |
| Implementation review | Verify code, tests, and evidence match proposal/design/specs. |

## Testing Context

Testing is represented by context plus a per-change plan:

- `openspec/harness/test-context.md` describes how the project starts, which
  environment prerequisites exist, and which verification approaches are
  trusted for frontend, backend, CLI, or integration behavior.
- `openspec/changes/<change>/test.md` describes how this specific change should
  be verified.

`/openspec-harness:verify` is the testing phase. It follows `test.md` using the
global context. For frontend user-visible changes, passing build or unit tests
is not enough; the running application must be exercised through browser-visible
behavior.

## Constitution

`openspec/harness/constitution.md` is the governance layer borrowed from the
Spec Kit style without replacing OpenSpec's lighter change model. It defines
required artifacts, review format, evidence rules, phase gates, and prohibited
shortcuts.

## OpenCode Integration

OpenCode commands live in `opencode.json` under the `openspec-harness:*`
namespace. The project plugin lives at `.opencode/plugins/openspec-harness.ts`.

OpenCode skills live under `.opencode/skills/openspec-harness-*/SKILL.md`.
OpenCode does not allow colon characters in skill names, so commands use the
user-facing `/openspec-harness:<phase>` shape while skills use
`openspec-harness-<phase>`.

The plugin currently provides:

- `tool.execute.before` archive gate for `openspec archive <change>`.
- `tool.execute.before` apply gate for implementation file edits.
- Optional `experimental.chat.system.transform` state reminder injection when `OPENSPEC_HARNESS_SYSTEM_CONTEXT=1`; default is off to avoid noisy OpenCode terminal output.
- `openspec_harness_status` custom tool.
- `openspec_harness_verify` custom tool.
- `openspec_harness_loop` custom tool.

## Loop

The first loop primitive is a single-step, gate-aware recommender and controlled
executor:

```bash
node ./bin/openspec-harness.mjs loop --change <change>
```

It reports the current state, next legal action, blocked gates, and exact next
command. With `--execute`, it can execute mechanical actions. Archive requires
both `--execute` and `--allow-archive`.

```bash
node ./bin/openspec-harness.mjs loop --change <change> --execute --allow-archive
```

It intentionally does not auto-edit implementation files, approve reviews, or
invent evidence.

## Test Plan

Default tests do not require a model:

```bash
npm run validate
```

`npm run validate` covers unit tests, OpenCode fixture shape, and
`openspec validate --all --strict`.

Optional headless SDK tests are gated:

```bash
OPENSPEC_HARNESS_E2E=1 npm run test:e2e
```

Headless OpenCode server smoke tests start `opencode serve`, connect with
`@opencode-ai/sdk`, and verify that project config loads the namespaced
commands:

```bash
npm run test:opencode-headless
```

`npm run validate:all` runs both default validation and the headless OpenCode
smoke test.

Future e2e should exercise a real DeepSeek-backed session only when explicitly
enabled.
