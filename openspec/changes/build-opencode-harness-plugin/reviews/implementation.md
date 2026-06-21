Status: approved

## Scope

对抗式实现评审：以怀疑论者立场重新审视 `build-opencode-harness-plugin` 的全部源码、测试和证据，针对 hook 门禁逻辑、状态机、loop 自动化、shell 绕过检测、测试覆盖率等核心路径进行交叉验证。评审基准包括 constitution.md、proposal.md、design.md、spec.md、源码（lib/ 全量）、测试（test/ 全量）以及测试日志（docs/evaluation/opencode-harness-test-log.md 中译版）。

## Blocking Issues

None

## Non-blocking Concerns

### 1. `process.env.OPENSPEC_CHANGE` 可被代理绕过（opencode-plugin-core.js:137）

`process.env.OPENSPEC_CHANGE ?? (await changeResolver(projectRoot))` 中环境变量具有最高优先级。在多 change 项目中，代理可通过 shell 工具在写入实现文件前设置 `OPENSPEC_CHANGE=已通过门禁的change`，绕过当前实际变更的 apply 门禁验证。单 change 项目不受影响（`inferSingleActiveChange` 会返回同一 change），但攻击面客观存在。

### 2. shell 写入检测存在误报（opencode-plugin-core.js:53-67）

`extractShellWritePaths` 的正则匹配会错误提取字符串字面量中的路径。例如 `echo "result > src/app.js"` 会被识别为对 `src/app.js` 的写入并触发门禁验证。虽然误报比漏报好（fail-closed），但可能导致无关命令被误拦截。

### 3. `spawnSync` 无超时保护（opencode-plugin-core.js:100, loop.js:137）

`runVerifier()` 和 `executeLoopStep()` 均使用 `spawnSync` 无超时参数。当 `openspec validate --all --strict` 因大仓库或网络问题挂起时，整个 OpenCode 代理会无限期冻结，无任何反馈机制。

### 4. `parseReview` 的 "None" 检测过于宽松（state-machine.js:55）

正则 `/none/i` 匹配任何包含 "none" 的内容。例如 `Blocking Issues: We verified none of the above scenarios occur` 会被判定为通过。这与 constitution 规定 "Blocking Issues must say `None`" 的严谨性要求存在偏差，削弱了机器可检查评审的可信度。

### 5. Archive 执行不可逆且无 dry-run（loop.js:137）

`executeLoopStep` 直接执行 `openspec archive <change> --yes`，无预演步骤。如果验证器因竞态条件错误通过，archive 一经提交无法撤销。虽然事后 `openspec validate` 可检测问题，但无法回滚已归档的 change。

### 6. hook 不校验文件归属（opencode-plugin-core.js:133-157）

hook 只检查"是否写入实现文件"和"活跃 change 门禁是否通过"，但不验证被写入文件的路径是否属于该 change。在多 change 项目中，代理可通过某个已通过的 change 验证门禁后，再写入属于另一个 change 的实现文件。这是门禁架构中的结构性缺口。

### 7. 多 change 项目直接阻塞所有实现工作（opencode-plugin-core.js:85）

`inferSingleActiveChange` 在 2 个及以上 change 时返回 `null`，导致 hook 抛出错误并阻止所有实现写入。除非手动设置 `OPENSPEC_CHANGE` 环境变量。这对需要同时处理多个 change 的工作流构成了实质性障碍。

### 8. `inferState` 不处理已拒绝评审（state-machine.js:135-167）

状态机推断只检查"评审是否已批准且有效"，不区分"评审不存在"和"评审被拒绝"。当一个 change 的 business review 被拒绝时，`inferState` 返回 `proposed`，而非某种能提示需要重写的状态。loop 也无法给出有针对性的恢复建议。

### 9. 状态链路单元测试覆盖不完整

`test/state-machine.test.mjs` 未覆盖 `inferState` → `exploring`、`proposal_reviewed`、`design_reviewed` 状态。9 个状态中仅 `applying`、`verified` 及 archive 门禁被测试。`verifyTransition` 在 apply mode 下缺少"design.md 不存在"时的跳过分支测试。

### 10. 插件 .ts 文件依赖隐式运行时行为（opencode.json:3）

`opencode.json` 引用 `.opencode/plugins/openspec-harness.ts`，项目无 TypeScript 编译步骤。插件加载完全依赖 OpenCode 内部对 `.ts` 文件的原生支持（推测为 Bun 内置）。如果 OpenCode 的 TS 加载机制变更或被禁用，插件将无法加载。

### 11. 全局安装脚本忽略 `XDG_CONFIG_HOME`（install-opencode-global.mjs:14）

`opencodeConfigRoot` 硬编码为 `~/.config/opencode`，不遵循 XDG 标准。若用户设置了 `XDG_CONFIG_HOME`，插件会被安装到错误路径，OpenCode 无法找到。

### 12. 缺少 `openspec` CLI 版本兼容性检查

`verify` 命令直接调用 `openspec validate --all --strict --no-interactive`，依赖系统 PATH 中的 `openspec`。不同版本的 `openspec` 输出格式和退出码可能有差异，但没有任何版本兼容性校验。

### 13. `createArchiveGateHook === createHarnessGateHook` 命名误导（opencode-plugin-core.js:161）

`createArchiveGateHook` 与 `createHarnessGateHook` 是完全相同的函数。命名暗示这是针对 archive 场景的特殊化 hook，但实际上并未提供 archive 专属的额外逻辑。plugin 注册时也未使用它。

## Assumptions Accepted

- 插件在单 change 开发工作流中运行是已验证的基线场景，多项问题主要影响多 change 工作流，可接受为后续迭代解决。
- 无头模式 OpenCode 冒烟测试（`test:opencode-headless`）足以证明插件加载、命令注册和工具注册功能正常。
- 外部测试项目中 `opencode run --command "openspec-harness:apply"` 配合 DeepSeek 模型的真实执行结果，足以作为全局打包插件可用的证据。
- shell 写入检测的误报率在当前常见使用模式下可接受（误报触发门禁验证的成本远低于漏报导致门禁失效的风险）。
- `spawnSync` 超时问题在实际使用中暂未遇到触发条件（`openspec validate` 通常秒级完成），可在观察后决定是否添加超时。

## Required Follow-ups

- 为 `OPENSPEC_CHANGE` 环境变量添加来源标记或优先级降级机制，降低代理绕过的可能性。长期方案是在 hook 层面建立文件到 change 的映射关系。
- 增强 shell 写入检测的路径提取精度，排除字符串字面量和注释中的路径。
- 为 `spawnSync` 调用添加超时参数（建议 30s），超时后返回可读的错误消息。
- 收紧 `parseReview` 中 "None" 的匹配规则，要求独立成行为 `None` 或至少要求该行中不含其他语义词汇。
- `executeLoopStep` 中 archive 执行前添加预检查步骤（调用 `verifyTransition` 再次确认 archive 门禁），作为防竞态的二次校验。
- 补充 `inferState` 对 `exploring`、`proposal_reviewed`、`design_reviewed` 状态的单元测试覆盖，以及 "design.md 不存在时跳过 design review" 的 apply mode 路径。
- 排除多 change 场景的盲区：`inferSingleActiveChange` 在 2+ change 时应返回更友好的错误建议（如"请设置 OPENSPEC_CHANGE 环境变量指定目标 change"）。
- 为 `openspec` CLI 添加最小版本检查（或在 `validate:openspec` 脚本中验证兼容性）。
- 评估是否需要为项目添加 `.ts → .js` 编译步骤，降低对 OpenCode 内置 TS 加载的依赖。

## Evidence Reviewed

- `lib/opencode-plugin-core.js`（195 行完整源码）：hook 门禁逻辑、shell 写入检测、change 解析、isImplementationWrite 判断
- `lib/state-machine.js`（244 行完整源码）：9 状态定义、状态推断算法、verifyTransition 双模式门禁、parseReview 格式校验
- `lib/loop.js`（166 行完整源码）：recommendNextAction 优先级决策、executeLoopStep 控制性执行
- `lib/cli.js`（189 行完整源码）：CLI 子命令分发、verify 双验证门禁（harness + openspec）
- `lib/opencode-plugin.js`（99 行完整源码）：插件工厂、自定义工具注册、系统上下文注入
- `test/state-machine.test.mjs`（6 个测试）、`test/opencode-plugin-core.test.mjs`（9 个测试）、`test/loop.test.mjs`（6 个测试）
- `scripts/install-opencode-global.mjs`、`scripts/validate-opencode-fixture.mjs`、`scripts/check-opencode-headless.mjs`
- `openspec/harness/constitution.md`、`openspec/changes/build-opencode-harness-plugin/proposal.md`、`design.md`、`tasks.md`、`evidence.md`、`reviews/business.md`、`reviews/design.md`、`specs/opencode-harness-plugin/spec.md`
- `docs/evaluation/opencode-harness-test-log.md`（中译版，11 步完整测试链路）
- `npm run validate:all` 运行结果确认
- `openspec validate --all --strict --no-interactive` 通过
- `openspec-harness verify --change build-opencode-harness-plugin --mode archive --json` 返回 `ok: true`
