# buddy-switch

Buddy 一键切换 CLI 插件（稀有度概率 + 热血孵化反馈）。

## 功能

- 一键随机切换：`random`
- 一键目标切换：`target --species/--rarity/--shiny`
- 概率面板：`prob`
- 当前宠物卡：`card`
- 一键回滚：`undo`
- 环境诊断：`doctor`
- companion 一致性同步：避免“卡片与界面效果不匹配”
- 哈希分支对齐：默认使用 `bun-compat(wyhash)`，与 Claude 渲染逻辑一致

## 安装

```bash
npm install
npm run build
```

构建后可直接运行：

```bash
node dist/cli.js --help
```

也可以开发态运行：

```bash
npm run dev -- --help
```


## 一键运行

```bash
./one-click.sh
```

- 不带参数时默认执行完整流程：`doctor -> prob -> random(热血情绪反馈) -> card`
- 默认流程结束后，直接按回车会继续抽卡，输入 `q` 退出
- 也可以传命令参数，例如：

```bash
./one-click.sh doctor
./one-click.sh target --species capybara --rarity legendary --shiny --max-attempts 500000
```

## 用法示例

```bash
# 完全随机切换
node dist/cli.js random

# 只要闪光
node dist/cli.js random --shiny-only

# 指定目标：传说水豚+闪光
node dist/cli.js target --species capybara --rarity legendary --shiny --max-attempts 500000

# 查看目标概率
node dist/cli.js prob --species capybara --rarity legendary --shiny

# 查看当前宠物
node dist/cli.js card

# 回滚上一次切换
node dist/cli.js undo

# 诊断 accountUuid 锁定
node dist/cli.js doctor
```

## 说明

- 本工具会自动备份 `~/.claude.json` 到 `~/.claude.json.buddy-switch.<timestamp>.bak`。
- 每次 `random/target` 会同步写入 `companion`（name/personality/bones），尽量保证 CLI 卡片与 Claude 界面效果一致。
- 每次切换会按当前物种重生成名字，避免“名称与当前宠物不对应”。
- 默认哈希模式是 `bun-compat(wyhash)`；如需回退历史行为，可设置 `BUDDY_HASH_MODE=fnv` 后再运行命令。
- CLI 现在会输出“双一致性”：
  - 配置一致性：`companion` 与种子推演是否一致
  - 运行态一致性：运行中的 Claude 会话是否可能尚未热更新 `userID`
- 若出现 `运行态一致性：⚠️`，表示不是算法映射错误，而是会话未热更新；脚本会追加提示“建议重开会话”。
- 如果检测到 `accountUuid`，`/buddy` 可能优先使用该值，单独修改 `userID` 可能不会立即生效。
- `card` 会同时展示“配置 companion”与“种子推演骨架”，并给出一致性诊断。
- 算法复刻自公开 Buddy 逻辑：`userId + friend-2026-401` → `Bun.hash(低32位)/FNV-1a` → `Mulberry32`。
