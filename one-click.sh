#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

NPM_LOCAL_CACHE="$ROOT_DIR/.buddy-switch-cache/npm"
mkdir -p "$NPM_LOCAL_CACHE"
export npm_config_cache="$NPM_LOCAL_CACHE"
export npm_config_update_notifier=false
export npm_config_fund=false
export npm_config_audit=false

install_dependencies() {
  echo "[buddy-switch] 首次运行，正在安装依赖..."

  local install_cmd=(npm install --no-audit --no-fund)
  if [ -f "package-lock.json" ]; then
    install_cmd=(npm ci --no-audit --no-fund)
  fi

  if ! "${install_cmd[@]}"; then
    echo "[buddy-switch] 依赖安装失败，正在清理本地 npm 缓存后重试..."
    npm cache clean --force >/dev/null 2>&1 || true
    rm -rf node_modules
    "${install_cmd[@]}"
  fi
}

if [ ! -d "node_modules" ] || [ ! -f "node_modules/chalk/package.json" ]; then
  install_dependencies
fi

if [ ! -f "dist/cli.js" ] || [ "${BUDDY_FORCE_REBUILD:-0}" = "1" ]; then
  echo "[buddy-switch] 正在构建..."
  npm run build >/dev/null
fi

print_card() {
  node dist/cli.js card
}

save_backup() {
  printf "备份名称（可空，回车默认）: "
  read -r backup_name
  if [ -n "${backup_name:-}" ]; then
    node dist/cli.js backup save --name "$backup_name"
  else
    node dist/cli.js backup save
  fi
}

list_backups() {
  node dist/cli.js backup list
}

restore_backup_by_id() {
  printf "请输入要恢复的备份 ID: "
  read -r backup_id
  if [ -z "${backup_id:-}" ]; then
    echo "[buddy-switch] 备份 ID 不能为空。"
    return
  fi
  node dist/cli.js backup restore --id "$backup_id"
}

exit_now() {
  # q 退出时直接结束脚本；若由 .command 触发且开启自动关闭，则尝试关闭终端窗口。
  if [ "${BUDDY_AUTOCLOSE_TERMINAL:-0}" = "1" ] && command -v osascript >/dev/null 2>&1; then
    osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 || true
  fi
  exit 0
}

if [ "$#" -eq 0 ]; then
  echo "[buddy-switch] 未提供参数，执行计划版一键流程：doctor -> prob -> random -> card"
  echo
  echo "========== 1/4 环境诊断 =========="
  node dist/cli.js doctor
  echo
  echo "========== 2/4 概率面板 =========="
  node dist/cli.js prob
  echo
  echo "========== 3/4 一键孵化（热血模式） =========="
  node dist/cli.js random
  echo
  echo "========== 4/4 当前宠物卡 =========="
  print_card

  # 交互式终端下支持连续随机抽卡
  if [ -t 0 ]; then
    while true; do
      echo
      printf "\033[1;36m快捷键：b 备份当前 | l 查看备份 | r 按ID恢复\033[0m\n"
      printf "\033[37m输入 q 退出\033[0m，\033[1;33m回车继续抽卡\033[0m: "
      read -r answer
      case "$answer" in
        q|Q|quit|QUIT|exit|EXIT)
          exit_now
          ;;
        b|B|backup|BACKUP)
          echo
          echo "========== 备份当前宠物 =========="
          save_backup
          ;;
        l|L|list|LIST)
          echo
          echo "========== 宠物备份列表 =========="
          list_backups
          ;;
        r|R|restore|RESTORE)
          echo
          echo "========== 按ID恢复宠物 =========="
          restore_backup_by_id
          ;;
        *)
          echo
          echo "========== 再来一抽（热血模式） =========="
          node dist/cli.js random
          echo
          echo "========== 当前宠物卡 =========="
          print_card
          ;;
      esac
    done
  fi
else
  echo "[buddy-switch] 执行：$*"
  if [ "$1" = "card" ]; then
    print_card
  else
    node dist/cli.js "$@"
  fi
fi
