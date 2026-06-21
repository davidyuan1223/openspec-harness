## Verification

- `npm run validate` passed.
- `npm run validate:all` passed after adding constitution, structured review
  validation, apply edit gates, and loop recommendation.
- `npm test` covers controlled loop execution and archive safety flags.
- `npm run test:opencode-headless` passed and reported `openspec_harness_status`
  `openspec_harness_verify`, and `openspec_harness_loop`.
- `opencode serve --help` confirmed headless server support.
- `opencode --version` reported `1.17.8`.

## Global OpenCode Packaging

- `npm run install:opencode-global` packs the project as scoped package
  `@davidyuan1223/openspec-harness-opencode@0.1.0`.
- The installer writes:
  - `/Users/fuyuanyuan/.config/opencode/plugins/openspec-harness.js`
  - `/Users/fuyuanyuan/.config/opencode/skills/openspec-harness-*`
  - global `opencode.jsonc` command entries for `openspec-harness:*`
- Installer refresh bug found and fixed:
  - stale `package-lock.json` in the OpenCode config directory could preserve an
    old tarball integrity.
  - installer now removes the old package directory and lockfile before install.

## Real OpenCode Test Project

- Test project:
  `/Users/fuyuanyuan/WebstormProjects/opencode-harness-test`
- Scenario: implement `splitBill(input)` from an OpenSpec change.
- First real apply run proved:
  - global skill loading works,
  - custom verifier tool works,
  - DeepSeek `deepseek-v4-pro` can follow the apply workflow.
- First real apply run also exposed two harness issues:
  - hook used `process.execPath`, which can point at the OpenCode executable in
    packaged runtime;
  - shell writes could bypass `edit`/`write` hook coverage.
- Fixes added:
  - hook verifier defaults to `node`;
  - shell write detection covers `>`/`>>` redirection and `tee`;
  - unit tests cover shell-write blocking and OpenSpec artifact exceptions.
- Retest after fixes:
  - OpenCode used normal `write` tool for `src/bill-splitter.js`;
  - hook did not false-block after apply gate passed;
  - `npm test` passed 3/3;
  - `tasks.md` evidence was updated by OpenCode.

## Review and Archive Gate Evidence

- Pre-review archive verify failed as expected because implementation review and
  `evidence.md` were missing.
- `/openspec-harness:review` produced:
  - `openspec/changes/add-bill-splitter/reviews/implementation.md`
  - `openspec/changes/add-bill-splitter/evidence.md`
- Review was adversarial enough to find non-blocking concerns:
  - incomplete defensive-branch test coverage,
  - `taxCents: null` silently defaults to zero,
  - non-array `people` error message is less precise,
  - spec should explicitly include explicit-tip and zero-tip scenarios.
- Final archive verification in the test project:
  - `openspec-harness verify --change add-bill-splitter --mode archive --json`
    returned `ok: true`, state `verified`.
  - `openspec-harness loop --change add-bill-splitter --json` recommended
    `archive`.

## Final Plugin Validation

- `npm run validate:all` passed after the real-test fixes.
- `npm run install:opencode-global` passed after installer refresh fix.
- Global runtime confirmed to contain:
  - `nodePath = "node"`
  - `extractShellWritePaths`
