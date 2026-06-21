## ADDED Requirements

### Requirement: OpenCode Command Namespace
The system SHALL expose OpenSpec Harness workflow commands through an
`openspec-harness:*` OpenCode command namespace.

#### Scenario: Invoke explore command
- **WHEN** a user invokes `/openspec-harness:explore`
- **THEN** OpenCode SHALL receive a prompt focused on business exploration and
  risk discovery before implementation.

### Requirement: OpenCode Agent Skills
The system SHALL provide OpenCode Agent Skills for reusable OpenSpec Harness
workflow behavior.

#### Scenario: Command references skill
- **WHEN** a user invokes an `openspec-harness:*` command
- **THEN** the command prompt SHALL direct OpenCode to load the matching
  `openspec-harness-*` skill.

### Requirement: Archive Gate
The system SHALL block OpenSpec archive attempts when harness gates fail.

#### Scenario: Archive before reviews pass
- **WHEN** an agent attempts to run `openspec archive <change>`
- **AND** required review gates are missing or rejected
- **THEN** the plugin SHALL block the command before execution.

### Requirement: Apply Gate
The system SHALL block implementation file edits when apply-mode harness gates
fail.

#### Scenario: Edit before business review approval
- **WHEN** an agent attempts to edit implementation files
- **AND** the active change does not pass apply-mode verification
- **THEN** the plugin SHALL block the edit before execution.

### Requirement: Loop Recommendation
The system SHALL provide a single-step loop recommendation that reports the next
legal OpenSpec Harness action.

#### Scenario: Verified change
- **WHEN** a change passes archive-mode verification
- **THEN** the loop recommendation SHALL return archive as the next legal
  action.

### Requirement: State Context Injection
The system SHALL inject current OpenSpec Harness state into OpenCode chat
context.

#### Scenario: Active change exists
- **WHEN** OpenCode builds system context for a session
- **THEN** the plugin SHALL include active changes, inferred state, task counts,
  missing evidence counts, and review gate status.
