#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"
export BUDDY_AUTOCLOSE_TERMINAL=1

exec "$ROOT_DIR/one-click.sh" "$@"
