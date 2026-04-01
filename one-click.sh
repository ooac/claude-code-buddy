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

print_card_with_runtime_hint() {
  local card_output
  card_output="$(node dist/cli.js card)"
  printf '%s\n' "$card_output"
  if printf '%s\n' "$card_output" | grep -q '运行态一致性：⚠️'; then
    echo "检测到运行中 Claude 可能未热更新 userID，建议重开会话。"
  fi
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
  print_card_with_runtime_hint

  # 交互式终端下支持连续随机抽卡
  if [ -t 0 ]; then
    while true; do
      echo
      printf "\033[36m输入 q 退出\033[0m，\033[1;33m回车继续抽卡\033[0m: "
      read -r answer
      case "$answer" in
        q|Q|quit|QUIT|exit|EXIT)
          echo "[buddy-switch] 抽卡结束，欢迎下次再来。"
          break
          ;;
        *)
          echo
          echo "========== 再来一抽（热血模式） =========="
          node dist/cli.js random
          echo
          echo "========== 当前宠物卡 =========="
          print_card_with_runtime_hint
          ;;
      esac
    done
  fi
else
  echo "[buddy-switch] 执行：$*"
  if [ "$1" = "card" ]; then
    print_card_with_runtime_hint
  else
    node dist/cli.js "$@"
  fi
fi
