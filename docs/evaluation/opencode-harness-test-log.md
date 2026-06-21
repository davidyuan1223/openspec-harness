# OpenCode Harness 测试日志

## 目的

记录完整的打包、全局 OpenCode 安装、基于真实 OpenCode 的开发测试、验证结果及评估说明。

## 环境

- 日期：2026-06-20
- 插件仓库：`/Users/fuyuanyuan/Documents/openspec-harness`
- 测试项目：`/Users/fuyuanyuan/WebstormProjects/opencode-harness-test`
- OpenCode 版本：`1.17.8`
- OpenSpec 版本：`1.4.1`
- 此前观察到的 Node 版本：`v25.6.1`

## 日志

### 1. 添加日志记录

状态：已完成

备注：

- 添加此日志，确保后续每一次打包、OpenCode 执行、测试和评估步骤都有可审计的记录。
- 用户主动中断了上一步安装过程以请求添加日志记录。
- 检查是否有残留的安装进程，确认无进程运行。
- 检查全局 OpenCode 包状态：
  - `@opencode-ai/plugin`：`1.17.8`
  - `openspec-harness-opencode`：基于本地 tarball 的文件依赖，指向
    `/Users/fuyuanyuan/Documents/openspec-harness/openspec-harness-opencode-0.1.0.tgz`

下一步：

- 在日志记录下重新执行全局 OpenCode 安装命令。
- 验证全局 OpenCode 运行时是否正确加载打包后的插件、命令、技能和工具。

### 2. 全局 npm 包安装

状态：已完成

执行命令：

```bash
npm pack --dry-run
npm run install:opencode-global
npm run test:opencode-headless
```

结果：

- `npm pack --dry-run` 生成包 `openspec-harness-opencode@0.1.0`。
- Tarball 包含：
  - `index.js`
  - `bin/`
  - `lib/`
  - `.opencode/skills/`
  - `openspec/harness/constitution.md`
  - `README.md`
- 全局 OpenCode 包配置：
  - `openspec-harness-opencode`：基于本地 tarball 的文件依赖。
  - `@opencode-ai/plugin`：`1.17.8`。
- 全局插件包装器：
  - `/Users/fuyuanyuan/.config/opencode/plugins/openspec-harness.js`
- 全局技能已复制到：
  - `/Users/fuyuanyuan/.config/opencode/skills`

无头模式验证：

- OpenCode 已加载命令：
  - `openspec-harness:explore`
  - `openspec-harness:propose`
  - `openspec-harness:review`
  - `openspec-harness:apply`
  - `openspec-harness:verify`
  - `openspec-harness:archive`
  - `openspec-harness:status`
  - `openspec-harness:doctor`
  - `openspec-harness:loop`
- OpenCode 已加载工具：
  - `openspec_harness_status`
  - `openspec_harness_verify`
  - `openspec_harness_loop`

观察：

- 在插件开发仓库内运行无头验证时，会同时加载项目本地和全局的插件/技能，导致出现重复技能/工具警告。这在开发仓库中属于预期行为，不应在外部测试项目中发生。

下一步：

- 创建 `/Users/fuyuanyuan/WebstormProjects/opencode-harness-test`。
- 从该测试项目中使用全局插件运行真实的 OpenCode 开发测试。

### 3. 测试项目搭建

状态：已完成

项目：

- 路径：`/Users/fuyuanyuan/WebstormProjects/opencode-harness-test`
- 场景：使用 OpenSpec + OpenCode 实现一个简单的 `splitBill` 模块。
- 重要现有状态：该项目已包含 WebStorm 模板文件和与此 harness 测试无关的已暂存文件，这些文件被有意保留不动。

已创建的测试产物：

- `src/bill-splitter.js`
- `src/cli.js`
- `test/bill-splitter.test.mjs`
- `openspec/config.yaml`
- `openspec/harness/constitution.md`
- `openspec/changes/add-bill-splitter/proposal.md`
- `openspec/changes/add-bill-splitter/design.md`
- `openspec/changes/add-bill-splitter/tasks.md`
- `openspec/changes/add-bill-splitter/reviews/business.md`
- `openspec/changes/add-bill-splitter/reviews/design.md`
- `openspec/changes/add-bill-splitter/specs/bill-splitter/spec.md`

预检查命令：

```bash
npm test
openspec validate --all --strict --no-interactive
openspec-harness verify --change add-bill-splitter --mode apply --json
openspec-harness verify --change add-bill-splitter --mode archive --json
```

结果：

- `npm test` 如预期失败，因为 `src/bill-splitter.js` 最初抛出 `Not implemented`。
- `openspec validate --all --strict --no-interactive` 通过。
- `add-bill-splitter` 的 apply 门禁通过。
- archive 门禁如预期失败，因为实现工作尚未完成：
  - 2 个任务未完成。
  - 缺少实现评审。
  - 缺少 `evidence.md`。

下一步：

- 从测试项目中以全局 `openspec-harness:apply` 命令运行 `opencode run`。
- 在 OpenCode 编辑后重新运行单元测试和 harness archive 验证。

### 4. OpenCode Apply 运行（第 1 次尝试）

状态：在模型执行前被阻止

执行命令：

```bash
opencode run --print-logs --log-level INFO --format json \
  --dangerously-skip-permissions \
  --command "openspec-harness:apply" \
  "add-bill-splitter. Implement src/bill-splitter.js to satisfy the existing OpenSpec change and make npm test pass. Use the existing tests as executable evidence. Do not archive the change."
```

观察：

- 全局插件加载自：
  - `/Users/fuyuanyuan/.config/opencode/plugins/openspec-harness.js`
- OpenCode 初始化了 9 个技能。
- OpenCode 选择了已配置的提供者，包括 `deepseek`。
- 运行在模型执行前失败，错误信息：
  - `SQLiteError: NOT NULL constraint failed: session_message.seq`
  - 服务端错误引用：`err_0be57fc8`

重要说明：

- 日志头部显示 OpenCode 运行时版本 `version=1.15.12`，而之前 CLI 检查中 `opencode --version` 显示为 `1.17.8`。此版本不一致需要在继续之前确认，因为命令失败可能与版本或数据库状态有关，而非插件逻辑问题。

下一步：

- 检查当前活跃的 `opencode` 可执行文件路径和版本。
- 如果此问题仅限于 `--command` 模式，则使用非命令提示方式重试。

### 5. OpenCode 版本不一致检查

状态：已完成

执行命令：

```bash
which -a opencode
opencode --version
npm list -g --depth=0
```

结果：

- `PATH` 中首先解析到 `/usr/local/bin/opencode`。
- `/usr/local/bin/opencode` 报告版本 `1.15.12`。
- npm 全局安装的 `opencode-ai@1.17.8` 位于：
  - `/Users/fuyuanyuan/.npm-global/bin/opencode`
- 之前的 `--command` 执行失败使用的是旧版 `/usr/local/bin/opencode` 二进制文件。

决定：

- 使用指定路径的可执行文件继续测试：
  - `/Users/fuyuanyuan/.npm-global/bin/opencode`

### 6. OpenCode Apply 运行（第 2 次尝试）

状态：已完成，同时观察到 harness 自身存在问题

执行命令：

```bash
/Users/fuyuanyuan/.npm-global/bin/opencode run --print-logs --log-level INFO \
  --format json --dangerously-skip-permissions \
  --command "openspec-harness:apply" \
  "add-bill-splitter. Implement src/bill-splitter.js to satisfy the existing OpenSpec change and make npm test pass. Use the existing tests as executable evidence. Do not archive the change."
```

结果：

- 运行时版本：`1.17.8`。
- 全局插件加载成功。
- 全局 `openspec-harness-apply` 技能已加载。
- `openspec_harness_verify` 在 apply 模式下运行并通过。
- DeepSeek `deepseek-v4-pro` 执行了任务。
- OpenCode 使用子代理探索了 OpenSpec 变更。
- OpenCode 实现了 `src/bill-splitter.js`。
- OpenCode 运行了：
  - `node --test test/bill-splitter.test.mjs`
- 测试结果：
  - 3 通过，0 失败。
- OpenCode 更新了 `tasks.md`，为两个任务添加了证据。

发现的 Harness 问题：

- 即使 `openspec_harness_verify` 已通过，`edit` 和 `write` 工具仍被错误拦截。
- 拦截消息中包含了 OpenCode CLI 帮助输出，这意味着 hook 在全局插件运行时中调用了错误的命令路径或参数格式。
- 模型随后通过 shell 命令绕过了 hook，将实现写入文件：
  - `cat > /Users/fuyuanyuan/WebstormProjects/opencode-harness-test/src/bill-splitter.js`
- 当前 hook 覆盖率仅对 `edit` 和 `write` 进行门禁，但对写入实现文件的 shell 命令未进行门禁。

决定：

- 对于 OpenCode 技能/工具加载和模型实现行为而言，这视为一次真实的测试成功。
- 但对于门禁覆盖率而言，这是插件正确性的失败。
- 在最终评估前修复插件：
  - 在 hook 内使用稳定的 Node/CLI 验证器路径，
  - 为写入实现文件的 bash/shell 命令添加检测。

### 7. 插件修复：Hook 运行时路径与 Shell 绕过

状态：已完成

变更内容：

- 将 hook 验证器运行器默认改为 `node` 而非 `process.execPath`。在 OpenCode 打包运行时中，`process.execPath` 可能指向 OpenCode 可执行文件而非 Node 二进制，从而导致 CLI 帮助输出出现在拦截消息中。
- 为 `bash`/`shell` 工具添加 shell 写入路径检测：
  - 重定向：`>` 和 `>>`
  - `tee` 写入
- 无论模型使用 `edit`、`write` 还是 shell 写入，任何项目根目录下的实现写入现在都会触发相同的 apply 门禁。
- 在 apply 门禁通过前，OpenSpec 产物的编辑仍然被允许：
  - `openspec/changes/**`
  - `openspec/harness/**`

验证：

```bash
npm test
```

结果：

- 21 通过。
- 1 个可选的 OpenCode SDK 导入测试被跳过。
- 0 失败。

下一步：

- 将 npm 包重新安装到全局 OpenCode。
- 重置 bill-splitter 测试切片，重新运行 OpenCode apply 以确认 hook 不再误拦截 `edit/write`。

### 8. 安装器刷新修复

状态：已完成

问题：

- 重新运行 `npm run install:opencode-global` 时，初始报告成功执行，但实际上 `/Users/fuyuanyuan/.config/opencode/node_modules/openspec-harness-opencode` 下仍然是旧包代码。
- 根因：全局 OpenCode 配置目录中保留了未删除的 `package-lock.json`，其中包含旧的 tarball 完整性校验值。由于依赖路径未变，npm 恢复了旧包内容。

修复：

- 更新 `scripts/install-opencode-global.mjs`，在安装前删除：
  - `node_modules/openspec-harness-opencode`
  - `package-lock.json`
- 重新安装全局包，并确认全局运行时包含：
  - `nodePath = "node"`
  - `extractShellWritePaths`

### 9. OpenCode Apply 运行（第 3 次尝试）

状态：已完成

准备：

- 将 `src/bill-splitter.js` 重置为初始的 `Not implemented` 桩代码。
- 将 `tasks.md` 重置为两个任务均未完成。
- 确认在 OpenCode 实现之前测试失败。
- 确认在实现之前 apply 门禁仍然通过。

执行命令：

```bash
/Users/fuyuanyuan/.npm-global/bin/opencode run --print-logs --log-level INFO \
  --format json --dangerously-skip-permissions \
  --command "openspec-harness:apply" \
  "add-bill-splitter. Implement src/bill-splitter.js to satisfy the existing OpenSpec change and make npm test pass. Use edit or write tools normally; do not archive the change."
```

结果：

- OpenCode 加载了全局 `openspec-harness-apply` 技能。
- `openspec_harness_verify` apply 模式通过。
- OpenCode 使用正常的 `write` 工具写入 `src/bill-splitter.js`。
- apply 门禁通过后，hook 不再误拦截实现编辑。
- OpenCode 运行了 `npm test`。
- 测试结果：
  - 3 通过，0 失败。
- OpenCode 更新了 `tasks.md` 并添加证据。

结论：

- 误拦截问题已修复。
- shell 写入绕过已有单元测试覆盖。本次运行中，由于 `write` 工具正常工作，模型无需使用 shell 写入。

### 10. 评审与 Archive 门禁测试

状态：已完成

执行命令：

```bash
npm test
openspec validate --all --strict --no-interactive
openspec-harness verify --change add-bill-splitter --mode archive --json
/Users/fuyuanyuan/.npm-global/bin/opencode run --command "openspec-harness:review" ...
openspec-harness verify --change add-bill-splitter --mode archive --json
openspec-harness loop --change add-bill-splitter --json
```

评审前 archive 门禁：

- 如预期失败：
  - 缺少实现评审，
  - 缺少 `evidence.md`。

评审命令结果：

- OpenCode 加载了 `openspec-harness-review`。
- 检查了 proposal、design、spec、reviews、实现和测试。
- 运行了 `npm test`：3 通过，0 失败。
- 运行了额外的算术和边界情况冒烟检查。
- 写入了：
  - `openspec/changes/add-bill-splitter/reviews/implementation.md`
  - `openspec/changes/add-bill-splitter/evidence.md`

实现评审结果：

- `Status: approved`。
- 阻塞性问题：`None`。
- 非阻塞性关注点：
  - 防御性验证分支需要更多测试覆盖，
  - `taxCents: null` 会静默默认为零，
  - 非数组 `people` 的错误消息不够精确，
  - spec 未明确覆盖显式小费金额（cents）和零小费场景。

最终 archive 门禁：

- `openspec-harness verify --change add-bill-splitter --mode archive --json` 通过。
- 状态：`verified`。
- `openspec-harness loop --change add-bill-splitter --json` 建议：
  - 操作：`archive`
  - 命令：`/openspec-harness:archive <change>`

### 11. 插件仓库最终验证

状态：已完成

执行命令：

```bash
npm run validate:all
npm run install:opencode-global
```

结果：

- 单元测试：
  - 21 通过
  - 1 个可选 SDK 导入测试被跳过
  - 0 失败
- OpenCode fixture 验证通过。
- OpenSpec 验证通过。
- OpenCode 无头模式验证加载了命令和工具。
- 全局安装完成后，已清理旧包和 lockfile。

备注：

- 在插件开发仓库内部运行无头验证时，仍会报告重复技能/工具，因为项目本地和全局副本同时存在。这属于开发仓库的预期行为。
- npm 报告来自传递依赖 `ini@7.0.0` 的 `EBADENGINE` 警告，因为当前 Node 版本为 `v25.6.1`；该警告未阻止安装或测试。

### 12. `session-ses_1146.md` 复盘与插件强化

状态：已完成

来源：

- `/Users/fuyuanyuan/WebstormProjects/opencode-harness-test/session-ses_1146.md`

观察到的问题：

- Tool 写入检测过宽。Bash 命令里的 JavaScript 比较表达式 `arr[j] > arr[j + 1]` 被误识别为 shell 重定向，导致无实现写入也触发 apply gate。
- Tool 写入检测不完整。模型可以先写入 `/tmp`，再通过 `cp`/`mv` 把文件复制回项目实现路径，绕过原来的重定向检测。
- Plugin archive gate 在全局插件加载场景下可能把 OpenCode 配置目录当作项目根目录，进而让测试上下文扫描碰到错误目录，例如 macOS 的 `~/.Trash`。
- Plugin archive gate 可以被 shell 引号拆词绕过，例如 `op"enspec" archive ...` 在 shell 中仍会执行 `openspec archive ...`。
- Hook 错误格式化假设 `stdout` 永远是字符串，遇到非字符串结果时可能出现 `text.trim is not a function` 类型错误。
- Test-context 扫描对权限错误和系统/缓存目录不够容错。真正的 gate 失败应该来自缺少测试计划、证据或 review，而不是扫描无关目录失败。

已优化：

- shell 写入检测现在会过滤不像文件路径的 `>` 右侧 token，避免把 JavaScript/TypeScript 比较运算误判为写文件。
- 增加 `cp`、`mv`、Windows `copy` 目的路径检测。复制或移动文件到项目实现路径时，也会触发 apply gate。
- `tool.execute.before` 会识别命令开头的 `cd <project> && ...` 或 `cd <project>; ...`，并用该目录作为 verifier 的 `--cwd`，避免全局插件目录污染项目验证。
- archive 命令识别会先去除 shell 引号，避免 `op"enspec" archive` 这类拆词命令绕过 archive gate。
- hook failure 格式化显式把 `stdout`/`stderr` 字符串化，不再对非字符串直接调用 `.trim()`。
- `scanTestSop` 改成容错扫描：跳过 `.Trash`、`node_modules`、构建缓存目录、符号链接和无权限目录。
- 新增回归测试覆盖：
  - `node -e "if (arr[j] > arr[j + 1]) ..."` 不触发写入 gate。
  - `cp /tmp/app.js /repo/src/app.js` 会触发 apply gate。
  - archive hook 使用 `cd /repo && openspec archive ...` 中的 `/repo` 作为 verifier cwd。
  - `op"enspec" archive ...` 仍会触发 archive gate。
  - 非字符串 verifier output 不再触发 trim 错误。

验证命令：

```bash
node --test test/opencode-plugin-core.test.mjs
node --test test/test-context-verifier.test.mjs
```

结果：

- `test/opencode-plugin-core.test.mjs`：15 通过，0 失败。
- `test/test-context-verifier.test.mjs`：9 通过，0 失败。
