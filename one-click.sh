#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d "node_modules" ]; then
  echo "[buddy-switch] 首次运行，正在安装依赖..."
  npm install
fi

echo "[buddy-switch] 正在构建..."
npm run build >/dev/null

print_card() {
  node dist/cli.js card
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
      printf "\033[37m输入 q 退出\033[0m，\033[1;33m回车继续抽卡\033[0m: "
      read -r answer
      case "$answer" in
        q|Q|quit|QUIT|exit|EXIT)
          exit_now
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
