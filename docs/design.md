# Design

## Goal

Build an OpenCode-first, context-aware OpenSpec Harness. OpenCode is the
runtime, OpenSpec is the change artifact engine, context documents preserve
long-lived project/user alignment, and the plugin enforces only high-risk
runtime boundaries.

## Layers

| Layer | Responsibility |
| --- | --- |
| Command | Human-facing workflow entrypoints such as `/openspec-harness:propose`. |
| Tool | Structured operations the agent can call explicitly. |
| Hook | Non-bypassable gates around risky actions. |
| Context | Long-lived project facts, user preferences, correction history, and testing reality. |
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
openspec/harness/context.md
openspec/harness/decision-log.md
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

## Context Sync

`openspec/harness/context.md` is not an OpenSpec change artifact. It records
stable user intent, project facts, preferences, and common drift risks that
should influence future changes.

`openspec/harness/decision-log.md` is append-only context history. It records
user corrections and the resulting realignment decision.

`/openspec-harness:context-sync` is used when a user correction, requirement
change, or implementation contradiction appears at any phase. It classifies the
impact level and recommends whether to continue the current change, update
proposal/design/test artifacts, or realign before implementation continues.

`/openspec-harness:docs-sync` checks long-lived documentation against runtime
surfaces: README, design docs, context docs, `opencode.json`, skills, tools,
and package metadata.

## Constitution

`openspec/harness/constitution.md` is the governance layer borrowed from the
Spec Kit style without replacing OpenSpec's lighter change model. It defines
required artifacts, review format, evidence rules, phase gates, and prohibited
shortcuts.

## OpenCode Integration

The repository keeps `opencode.json` as a fixture and local development
configuration for the legacy `openspec-harness:*` command namespace. User
installation defaults to OMO-style command files under
`.opencode/command/openspec-harness-*.md`, which are copied to the OpenCode
global config directory by the installer.

The project plugin lives at `.opencode/plugins/openspec-harness.ts`.

OpenCode skills live under `.opencode/skills/openspec-harness-*/SKILL.md`.
OpenCode does not allow colon characters in skill names, so OMO-style command
files and skills use `openspec-harness-<phase>`. Legacy OpenCode config commands
use `/openspec-harness:<phase>` only when installed with `--command-mode config`.

The plugin currently provides:

- `tool.execute.before` archive gate for `openspec archive <change>`.
- `tool.execute.before` apply gate for implementation file edits.
- Optional `experimental.chat.system.transform` state reminder injection when `OPENSPEC_HARNESS_SYSTEM_CONTEXT=1`; default is off to avoid noisy OpenCode terminal output.
- `openspec_harness_status` custom tool.
- `openspec_harness_verify` custom tool.
- `openspec_harness_loop` custom tool.
- `openspec_harness_context_sync` custom tool.
- `openspec_harness_docs_sync` custom tool.

## Install Integration

The package is installed as a normal scoped npm package, then configured through
the CLI installer:

```bash
openspec-harness install
openspec-harness doctor --global
```

The installer follows the oh-my-opencode integration shape: it treats OpenCode's
global config directory as the runtime home, writes a package dependency there,
runs `npm install`, writes a thin plugin wrapper, merges plugin and skill
permissions, syncs OMO-style command files into `command/`, and syncs the
packaged `openspec-harness-*` skills into the global skills directory.

The default command mode is `files`, which avoids writing multi-line command
templates into the user's `opencode.jsonc`. `--command-mode config` is retained
as a legacy compatibility mode for users who do not use OMO's slashcommand
discovery. `--prune-config-commands` can remove previously installed
`openspec-harness:*` global config commands when migrating to command files.

The default plugin registration uses `./plugins/openspec-harness.js` rather than
requiring OpenCode to resolve a scoped registry package directly. This avoids
team-member setup failures caused by missing GitHub Packages auth or npm scope
registry configuration. Advanced users may still register the package spec
directly with `--plugin-mode package`.

The installer resolves config paths cross-platform:

- macOS/Linux: `${XDG_CONFIG_HOME:-~/.config}/opencode`
- Windows: existing `%USERPROFILE%\.config\opencode`, existing
  `%APPDATA%\opencode`, then `%USERPROFILE%\.config\opencode`
- explicit override: `OPENCODE_CONFIG_DIR` or `--config-dir`

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
