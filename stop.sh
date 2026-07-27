#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/run/backend.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "未找到运行中的服务 PID 文件。"
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -z "$PID" ]]; then
  rm -f "$PID_FILE"
  echo "PID 文件为空，已清理。"
  exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "服务进程不存在，已清理残留 PID 文件。"
  exit 0
fi

echo "停止服务进程 ${PID}..."
kill "$PID"

for _ in {1..20}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "服务已停止。"
    exit 0
  fi
  sleep 1
done

echo "进程未在预期时间退出，发送强制停止信号..."
kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "服务已强制停止。"
