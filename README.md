# buddy-switch

Buddy 一键切换 CLI 插件（稀有度概率 + 热血孵化反馈）。

## 功能概览

- 一键随机切换：`random`
- 一键目标切换：`target --species/--rarity/--shiny`
- 概率面板：`prob`
- 当前宠物卡：`card`
- 一键回滚：`undo`
- 手动宠物备份池：`backup save/list/restore`
- 诊断模式：`doctor`
- companion 同步策略：仅持久化 soul（`name/personality/hatchedAt`）
- 哈希默认分支：`bun-exact(bun-wyhash)`（可用 `BUDDY_HASH_MODE=fnv` 回退）
- 跨平台分发：npm 包 + 免安装 Node 的可迁移压缩包（Win x64 / Mac arm64）

## 安装与开发

```bash
npm install
npm run build
```

开发态：

```bash
npm run dev -- --help
```

## CLI 用法

```bash
# 完全随机切换
node dist/cli.js random

# 目标切换
node dist/cli.js target --species capybara --rarity legendary --shiny --max-attempts 500000

# 概率面板
node dist/cli.js prob --species capybara --rarity legendary --shiny

# 当前宠物卡
node dist/cli.js card

# 回滚
node dist/cli.js undo

# 手动备份当前宠物（完整配置快照）
node dist/cli.js backup save --name "我的收藏1"

# 列出备份池（ID / 时间 / 物种 / 稀有度 / 闪光 / userID 摘要）
node dist/cli.js backup list

# 按备份 ID 恢复到某只宠物
node dist/cli.js backup restore --id pet-abc123

# 诊断
node dist/cli.js doctor
```

## 路径覆盖（Win/Mac 通用）

支持 CLI 参数与环境变量双覆盖，优先级固定：

`CLI 参数 > 环境变量 > 默认 HOME`

- CLI 参数：
  - `--config-path <absPath>`
  - `--state-path <absPath>`
- 环境变量：
  - `BUDDY_CONFIG_PATH`
  - `BUDDY_STATE_PATH`

示例：

```bash
buddy-switch --config-path "/Users/me/Space Dir/my.claude.json" --state-path "/Users/me/Space Dir/state.json" random
```

```powershell
buddy-switch --config-path "D:\Claude Data\my.claude.json" --state-path "D:\Claude Data\state.json" random
```

## 一键运行入口

- macOS：`run-mac.command`（双击可运行）
- Windows：`run-win.cmd`（双击可运行）
- 通用脚本（当前仓库）：`one-click.sh`

默认流程：`doctor -> prob -> random -> card`，随后支持连抽：

- 输入 `q` 退出
- 回车继续抽卡
- 输入 `b` 立即备份当前宠物（支持输入备份名称）
- 输入 `l` 查看宠物备份列表
- 输入 `r` 按备份 ID 恢复宠物

## 分发（双轨）

### 1) npm 包（开发者安装）

```bash
npm run pack:npm
```

### 2) 便携压缩包（免安装 Node）

```bash
npm run pack:portable
```

默认产物：

- `release/buddy-switch-win-x64.zip`
- `release/buddy-switch-macos-arm64.zip`

包内固定结构：

- `runtime/`（内置 Node Runtime）
- `app/`（CLI 程序与依赖）
- 启动器（ASCII 文件名）

一键打全量：

```bash
npm run pack:all
```

可通过环境变量指定 Runtime 版本（未设置时使用当前 Node 版本）：

```bash
NODE_RUNTIME_VERSION=20.19.0 npm run pack:portable
```

可只打某个平台：

```bash
BUDDY_PORTABLE_TARGETS=win-x64 npm run pack:portable
BUDDY_PORTABLE_TARGETS=macos-arm64 npm run pack:portable
```

## Windows UTF-8 防乱码策略

`buddy-switch.cmd` / `run-win.cmd` 启动时会自动：

1. 执行 `chcp 65001`
2. 若失败或未切换成功，自动设置 `BUDDY_FORCE_ASCII=1`
3. CLI 输出降级为 ASCII/英文（无 Emoji/宽字符），避免控制台乱码与错位

## 说明

- 默认读写 `~/.claude.json` 与 `~/.buddy-switch/state.json`。
- 切换前自动备份配置：`~/.claude.json.buddy-switch.<timestamp>.bak`。
- 手动备份池仅在执行 `backup save` 时写入（不会在每次抽卡自动入库）。
- 备份池最多保留 5 条；新增第 6 条时会自动淘汰最旧一条并清理其快照文件。
- `backup restore` 在交互终端会先询问是否为“当前配置”创建保护备份（`y/N`）；非交互环境默认跳过并提示。
- `card` 以“种子推演骨架 + companion soul”展示。
- `doctor` 提供 accountUuid 与运行态诊断，不自动重启 Claude 进程。

## 常见问题

- macOS 首次运行若遇到 `npm ERR! EEXIST / EACCES`（缓存重命名失败）：
  - 新版一键脚本会自动使用项目内本地缓存目录 `.buddy-switch-cache/npm`，避免依赖全局 `~/.npm` 权限。
  - 如仍失败，可删除项目下 `.buddy-switch-cache` 与 `node_modules` 后重试。
