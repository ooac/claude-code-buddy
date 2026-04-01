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

colorize_backup_indexes() {
  local text="$1"
  local yellow=$'\033[1;33m'
  local reset=$'\033[0m'
  text="${text//\[1\]/[${yellow}1${reset}]}"
  text="${text//\[2\]/[${yellow}2${reset}]}"
  text="${text//\[3\]/[${yellow}3${reset}]}"
  text="${text//\[4\]/[${yellow}4${reset}]}"
  text="${text//\[5\]/[${yellow}5${reset}]}"
  printf "%s\n" "$text"
}

backup_browser_mode() {
  while true; do
    echo
    echo "========== 宠物备份列表 =========="
    backup_list_output="$(list_backups)"
    colorized_backup_list_output="$(colorize_backup_indexes "$backup_list_output")"
    printf "%s\n" "$colorized_backup_list_output"
    printf "\033[37m输入 q 返回主模式\033[0m，\033[1;33m输入 1~5 恢复备份\033[0m: "
    read -r backup_action
    case "$backup_action" in
      q|Q|quit|QUIT|exit|EXIT)
        return
        ;;
      [1-5])
        if ! printf "%s\n" "$backup_list_output" | grep -Fq -- "- [${backup_action}] ID:"; then
          echo "[buddy-switch] 当前列表中没有序号 ${backup_action}，请重新选择。"
          continue
        fi
        node dist/cli.js backup restore --index "$backup_action"
        return
        ;;
      *)
        echo "[buddy-switch] 仅支持输入 1~5 或 q。"
        ;;
    esac
  done
}

exit_now() {
  # q 退出时直接结束脚本；若由 .command 触发且开启自动关闭，则尝试关闭终端窗口。
  if [ "${BUDDY_AUTOCLOSE_TERMINAL:-0}" = "1" ] && command -v osascript >/dev/null 2>&1; then
    osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 || true
  fi
  exit 0
}

if [ "$#" -eq 0 ]; then
  echo "[buddy-switch] 已进入待机模式：默认不会自动抽卡。"
  echo "[buddy-switch] 操作提示：回车抽卡，输入 b 备份，输入 c 查看/恢复备份，输入 q 退出。"

  # 交互式终端下支持按需抽卡
  if [ -t 0 ]; then
    while true; do
      echo
      printf "\033[1;36m快捷键：b 备份当前 | c 查看/恢复备份\033[0m\n"
      printf "\033[37m输入 q 退出\033[0m，\033[1;33m回车继续抽卡\033[0m: "
      read -r answer
      case "$answer" in
        '')
          echo
          echo "========== 再来一抽（热血模式） =========="
          node dist/cli.js random
          echo
          echo "========== 当前宠物卡 =========="
          print_card
          ;;
        q|Q|quit|QUIT|exit|EXIT)
          exit_now
          ;;
        b|B|backup|BACKUP)
          echo
          echo "========== 备份当前宠物 =========="
          save_backup
          ;;
        c|C|check|CHECK|list|LIST)
          backup_browser_mode
          ;;
        *)
          echo "[buddy-switch] 不支持该输入。请直接回车抽卡，或输入 b / c / q。"
          ;;
      esac
    done
  else
    echo "[buddy-switch] 当前为非交互模式，默认不执行抽卡。可传入命令参数直接执行，例如：./one-click.sh random"
  fi
else
  echo "[buddy-switch] 执行：$*"
  if [ "$1" = "card" ]; then
    print_card
  else
    node dist/cli.js "$@"
  fi
fi
