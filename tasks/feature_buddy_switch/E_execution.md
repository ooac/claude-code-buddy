# E 执行日志

## 任务 #1.1：工程初始化（Node + TS + CLI） ✅
**状态**：已完成
**时间**：2026-04-01 17:36 - 2026-04-01 17:41
**执行者**：LD

### 实现结果
- ✅ 初始化 `package.json`、`tsconfig.json`、`vitest.config.ts`
- ✅ 建立 `src/core`、`src/io`、`src/ui` 目录
- ✅ 设置构建、开发、测试脚本

### 相关文件
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`

## 任务 #1.2：Buddy 核心算法复刻 ✅
**状态**：已完成
**时间**：2026-04-01 17:41 - 2026-04-01 17:48
**执行者**：LD

### 实现结果
- ✅ 复刻 `FNV-1a` + `Mulberry32`
- ✅ 复刻稀有度权重 `60/25/10/4/1`
- ✅ 实现 `shiny: 1%` 独立概率
- ✅ 实现 18 物种、眼睛、帽子与属性生成

### 相关文件
- `src/core/types.ts`
- `src/core/seed.ts`
- `src/core/buddy-engine.ts`
- `src/core/probability.ts`

## 任务 #1.3：配置备份/写入/回滚链路 ✅
**状态**：已完成
**时间**：2026-04-01 17:48 - 2026-04-01 17:54
**执行者**：LD

### 实现结果
- ✅ 支持读写 `~/.claude.json`
- ✅ 切换前自动生成 `.buddy-switch.<timestamp>.bak`
- ✅ 写入失败自动回滚
- ✅ 实现状态文件与 `undo` 追踪

### 相关文件
- `src/io/claude-config.ts`
- `src/io/state.ts`

## 任务 #1.4：CLI 六命令实现 ✅
**状态**：已完成
**时间**：2026-04-01 17:54 - 2026-04-01 17:59
**执行者**：LD

### 实现结果
- ✅ `random`
- ✅ `target`
- ✅ `prob`
- ✅ `card`
- ✅ `undo`
- ✅ `doctor`

### 相关文件
- `src/cli.ts`

## 任务 #1.5：情绪价值交互 ✅
**状态**：已完成
**时间**：2026-04-01 17:59 - 2026-04-01 18:00
**执行者**：LD

### 实现结果
- ✅ 实现蓄力→开蛋→揭晓分段动画
- ✅ 按稀有度与闪光触发不同热血文案
- ✅ 连续非酋时输出安慰提示与“下一抽稀有及以上概率”

### 相关文件
- `src/ui/hype.ts`
- `src/ui/render.ts`

## 任务 #1.6：单元与集成测试 ✅
**状态**：已完成
**时间**：2026-04-01 18:00 - 2026-04-01 18:02
**执行者**：TE

### 实现结果
- ✅ 算法确定性与过滤逻辑测试
- ✅ 概率计算测试
- ✅ 配置备份与回滚测试
- ✅ CLI 全流程集成测试（random→target→undo）

### 相关文件
- `src/core/buddy-engine.test.ts`
- `src/core/probability.test.ts`
- `src/io/claude-config.test.ts`
- `src/cli.integration.test.ts`

## 任务 #1.8：一键运行脚本 ✅
**状态**：已完成
**时间**：2026-04-01 18:34 - 2026-04-01 18:36
**执行者**：LD

### 实现结果
- ✅ 新增 `one-click.sh`，支持依赖检查、构建与一键执行
- ✅ 新增 `一键运行.command`，支持 macOS 直接双击启动
- ✅ 实测 `./one-click.sh doctor` 执行通过
- ✅ README 新增“一键运行”章节

### 相关文件
- `one-click.sh`
- `一键运行.command`
- `README.md`

## 任务 #1.9：修复 companion 不一致问题 ✅
**状态**：已完成
**时间**：2026-04-01 18:50 - 2026-04-01 18:58
**执行者**：LD

### 实现结果
- ✅ 切换链路增加 `companion` 同步写入，不再只改 `userID`
- ✅ `card` 增加双视图：`companion（配置侧）` + `种子推演骨架`
- ✅ `card` 增加一致性诊断，自动提示是否存在错配
- ✅ 新增 companion 同步单元测试与配置写入测试

### 相关文件
- `src/core/companion-sync.ts`
- `src/core/companion-sync.test.ts`
- `src/io/claude-config.ts`
- `src/io/claude-config.test.ts`
- `src/cli.ts`
- `src/cli.integration.test.ts`
- `README.md`

## 任务 #1.10：修复哈希分支错位（Bun.wyhash 对齐） ✅
**状态**：已完成
**时间**：2026-04-01 19:03 - 2026-04-01 19:08
**执行者**：LD

### 实现结果
- ✅ 将默认哈希从 FNV-1a 调整为 `bun-compat(wyhash)`，与 Claude 渲染分支对齐
- ✅ 保留 `BUDDY_HASH_MODE=fnv` 回退开关
- ✅ `card/doctor/random` 输出当前哈希模式，便于诊断
- ✅ 增加 seed 哈希模式单元测试（bun/fnv 切换与结果校验）

### 相关文件
- `src/core/seed.ts`
- `src/core/seed.test.ts`
- `src/cli.ts`
- `README.md`
- `package.json`
- `package-lock.json`

## 任务 #1.11：优化连续抽卡交互 + 名称按物种同步刷新 ✅
**状态**：已完成
**时间**：2026-04-01 19:10 - 2026-04-01 19:13
**执行者**：LD

### 实现结果
- ✅ 一键脚本改为“回车继续抽卡，输入 q 退出”
- ✅ 每次切换按当前物种重新生成宠物名称，不再沿用旧名导致错配感
- ✅ 同步更新 README 使用说明
- ✅ 全量测试通过（14/14）

### 相关文件
- `one-click.sh`
- `一键运行.command`
- `src/core/companion-sync.ts`
- `src/core/companion-sync.test.ts`
- `README.md`

## 任务 #1.12：运行态一致性检测（仅告警） ✅
**状态**：已完成
**时间**：2026-04-01 19:20 - 2026-04-01 19:27
**执行者**：LD

### 实现结果
- ✅ 新增 `runtime-drift` 模块，支持 `safe / stale_possible / no_claude_process` 三态
- ✅ `random/target/card/doctor` 增加运行态一致性输出，避免“算法一致但界面未热更新”误判
- ✅ stale 场景输出强提示：当前 Claude 左下角宠物可能仍是旧骨架，建议重开会话
- ✅ 一键脚本在 `card` 命中 stale 时追加固定提示文案（不自动重启）
- ✅ 补齐单元测试、CLI 集成测试与脚本集成测试，回归 21/21 全通过

### 相关文件
- `src/io/runtime-drift.ts`
- `src/io/runtime-drift.test.ts`
- `src/cli.ts`
- `src/cli.integration.test.ts`
- `src/one-click.integration.test.ts`
- `one-click.sh`
- `一键运行.command`
- `README.md`

## 任务 #1.13：跨平台可迁移分发（Win x64 + Mac arm64 + UTF-8 防乱码） ✅
**状态**：已完成
**时间**：2026-04-01 20:30 - 2026-04-01 20:55
**执行者**：LD

### 实现结果
- ✅ 新增双轨分发脚本：`npm pack` + 便携包（`release/buddy-switch-win-x64.zip`、`release/buddy-switch-macos-arm64.zip`）
- ✅ 新增 `scripts/package-portable.mjs`：自动下载平台 Node Runtime，组装 `runtime/ + app/ + ASCII 启动器`
- ✅ 新增 Windows 启动器 `buddy-switch.cmd`、`run-win.cmd`：启动时 `chcp 65001`，失败自动设置 `BUDDY_FORCE_ASCII=1`
- ✅ 新增 macOS ASCII 启动器 `run-mac.command`，保留回车续抽与 `q` 退出
- ✅ CLI 补齐路径覆盖能力：`--config-path / --state-path` 与 `BUDDY_CONFIG_PATH / BUDDY_STATE_PATH`
- ✅ 增加路径优先级与 ASCII 降级测试，覆盖空格/中文路径与无 Emoji 输出分支
- ✅ 补齐 GitHub Actions 发布工作流（Win/Mac 产物 + npm 包上传）

### 相关文件
- `scripts/package-portable.mjs`
- `run-mac.command`
- `run-win.cmd`
- `buddy-switch.cmd`
- `package.json`
- `.github/workflows/release.yml`
- `src/io/path-options.ts`
- `src/io/path-options.test.ts`
- `src/cli.integration.test.ts`
- `src/io/runtime-drift.ts`
- `README.md`

## 任务 #1.14：手动宠物备份池（save/list/restore + 5条轮转） ✅
**状态**：已完成
**时间**：2026-04-01 22:10 - 2026-04-01 22:25
**执行者**：LD

### 实现结果
- ✅ 新增 `backup` 命令组：`backup save`、`backup list`、`backup restore --id`
- ✅ 备份内容为完整配置快照（非仅宠物字段），并落盘到 `statePath` 同级 `backups/` 目录
- ✅ 备份池新增 `petBackups` 元数据，最多保留 5 条；超限自动淘汰最旧并清理快照文件
- ✅ `backup restore` 支持按 ID 恢复，非交互环境默认跳过保护备份并输出提示
- ✅ 交互环境支持 `y/N` 确认是否先做“当前配置保护备份”
- ✅ 恢复完成后立即输出当前宠物卡，减少二次确认成本
- ✅ 补齐单元测试与集成测试（含中文/空格路径、轮转、错误分支）

### 相关文件
- `src/cli.ts`
- `src/io/state.ts`
- `src/io/restore-confirm.ts`
- `src/io/restore-confirm.test.ts`
- `src/io/state.test.ts`
- `src/io/claude-config.ts`
- `src/io/claude-config.test.ts`
- `src/cli.integration.test.ts`
- `README.md`

## 任务 #1.15：一键交互菜单补齐备份入口（b/l/r） ✅
**状态**：已完成
**时间**：2026-04-01 22:40 - 2026-04-01 22:50
**执行者**：LD

### 实现结果
- ✅ `one-click.sh` 新增交互快捷项：`b` 备份、`l` 列表、`r` 按ID恢复（保留 `q` 退出与回车抽卡）
- ✅ `run-win.cmd` 同步新增备份交互入口，保持 Win/Mac 体验一致
- ✅ 便携包模板（`scripts/package-portable.mjs`）同步菜单，避免分发后功能缩水
- ✅ README 一键交互说明补齐备份相关提示
- ✅ 修复并行测试构建竞态：恢复 `build` 为非清空模式，仅便携打包时清理 `dist`
- ✅ 新增 `one-click` 透传 `backup list` 集成测试并通过

### 相关文件
- `one-click.sh`
- `run-win.cmd`
- `scripts/package-portable.mjs`
- `README.md`
- `package.json`
- `src/one-click.integration.test.ts`

## 任务 #1.16：备份交互简化（c查看 + 序号恢复1~5） ✅
**状态**：已完成
**时间**：2026-04-01 23:30 - 2026-04-01 23:40
**执行者**：LD

### 实现结果
- ✅ 一键交互将“查看备份”快捷键从 `l` 改为 `c`，避免与数字 `1` 视觉混淆
- ✅ 恢复逻辑改为按序号（`1~5`）恢复，不再依赖手输长 ID
- ✅ CLI `backup restore` 新增 `--index <1~5>`（推荐），保留 `--id` 兼容
- ✅ `backup list` 增加序号展示（`[1]...[5]`）
- ✅ 同步更新 Win 脚本与便携包模板，保证分发后行为一致
- ✅ 补充集成测试覆盖序号恢复和无效序号错误分支

### 相关文件
- `src/cli.ts`
- `src/cli.integration.test.ts`
- `one-click.sh`
- `run-win.cmd`
- `scripts/package-portable.mjs`
- `README.md`

## 任务 #1.17：一键脚本恢复流程重构（`c` 子界面统一查看与按序号恢复） ✅
**状态**：已完成
**时间**：2026-04-01 23:45 - 2026-04-01 23:57
**执行者**：LD

### 实现结果
- ✅ 主模式移除 `r` 快捷键，只保留 `b / c / q / 回车`
- ✅ `c` 进入备份子界面：每轮先显示备份列表，再仅接受 `1~5` 恢复或 `q` 返回主模式
- ✅ 增加“序号存在性”校验：当当前列表无该序号时，给出明确提示并留在子界面
- ✅ 恢复成功后自动返回主模式，避免再走二次路径
- ✅ `run-win.cmd` 与 `scripts/package-portable.mjs` 生成模板同步同逻辑，消除源码与分发行为偏差
- ✅ 修复 `scripts/package-portable.mjs` 模板中的未转义 `${}` 语法问题，恢复 `pack:portable` 可执行性
- ✅ 更新 README 一键交互说明，明确恢复仅在 `c` 子界面执行
- ✅ 全量回归通过：`npm run build && npm test`（39/39）

### 相关文件
- `one-click.sh`
- `run-win.cmd`
- `scripts/package-portable.mjs`
- `README.md`

## 任务 #1.18：一键启动待机化（默认不抽卡，回车才抽卡） ✅
**状态**：已完成
**时间**：2026-04-02 00:00 - 2026-04-02 00:06
**执行者**：LD

### 实现结果
- ✅ `one-click.sh` 无参数启动改为待机模式，不再自动执行 `doctor/prob/random/card`
- ✅ 主循环改为“仅回车抽卡”；其余输入中仅 `b/c/q` 生效，非法输入仅提示不触发抽卡
- ✅ `run-win.cmd` 同步为待机启动，且仅在回车时执行 `random + card`
- ✅ 便携包模板（`scripts/package-portable.mjs`）中 Win/Mac 启动器同步同逻辑，避免分发行为偏差
- ✅ README 更新为“默认待机、回车抽卡”语义
- ✅ 新增一键脚本集成测试：验证无参数启动不会自动抽卡

### 相关文件
- `one-click.sh`
- `run-win.cmd`
- `scripts/package-portable.mjs`
- `README.md`
- `src/one-click.integration.test.ts`

## 任务 #1.19：备份子界面序号高亮（`[1]~[5]` 黄色） ✅
**状态**：已完成
**时间**：2026-04-02 00:10 - 2026-04-02 00:12
**执行者**：LD

### 实现结果
- ✅ `one-click.sh` 在备份子界面新增显示层着色：`[1]~[5]` 数字以黄色输出
- ✅ 保留原始列表文本用于序号存在性校验，避免影响恢复逻辑
- ✅ 便携包模板 `scripts/package-portable.mjs` 的 mac 启动器同步同样高亮策略，保证迁移包一致体验

### 相关文件
- `one-click.sh`
- `scripts/package-portable.mjs`
