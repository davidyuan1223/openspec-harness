# OpenCode Official Notes

Source: <https://opencode.ai/docs/de>

Key implementation constraints used by this project:

- Install with `npm install -g opencode-ai`; the executable is `opencode`.
- `opencode serve` starts a headless server.
- `opencode run` supports `--attach` for an existing server and `--command` for custom commands.
- Project configuration is `opencode.json` or `opencode.jsonc`.
- Custom commands can be declared under the `command` key.
- oh-my-opencode / OMO discovers additional command files from
  `.opencode/command/*.md` and `<opencode-config>/command/*.md`.
- Agent skills live at `.opencode/skills/<name>/SKILL.md`.
- Skill names must use lowercase letters, digits, and single hyphens only; colon
  names are not valid skill names, so this project uses colon names for commands
  and hyphen names for skills.
- Project plugins can live in `.opencode/plugins/`.
- NPM plugins can be listed under the `plugin` key.
- Plugin functions receive `project`, `client`, `directory`, `worktree`, and `$`.
- Plugin hooks include `tool.execute.before`, `tool.execute.after`, `shell.env`,
  `event`, and experimental chat transforms.
- TypeScript plugins can import `Plugin` and `tool` from `@opencode-ai/plugin`.
- The JS SDK package is `@opencode-ai/sdk`.
