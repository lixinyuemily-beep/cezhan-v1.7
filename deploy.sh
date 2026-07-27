#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
LOG_DIR="$SCRIPT_DIR/logs"
RUN_DIR="$SCRIPT_DIR/run"
PID_FILE="$RUN_DIR/backend.pid"

PYTHON_BIN="${PYTHON_BIN:-python3}"
APP_HOST="${APP_HOST:-0.0.0.0}"
APP_PORT="${APP_PORT:-8000}"
APP_WORKERS="${APP_WORKERS:-2}"
APP_PUBLIC_BASE_URL="${APP_PUBLIC_BASE_URL:-http://localhost:${APP_PORT}}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/health}"
LOG_FILE="$LOG_DIR/backend.log"

mkdir -p "$LOG_DIR" "$RUN_DIR"

stop_existing_service() {
  if [[ ! -f "$PID_FILE" ]]; then
    return
  fi

  local old_pid
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$old_pid" ]]; then
    rm -f "$PID_FILE"
    return
  fi

  if kill -0 "$old_pid" 2>/dev/null; then
    echo "停止旧服务进程 ${old_pid}..."
    kill "$old_pid" 2>/dev/null || true

    for _ in {1..20}; do
      if ! kill -0 "$old_pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done

    if kill -0 "$old_pid" 2>/dev/null; then
      echo "旧进程未正常退出，升级为强制停止..."
      kill -9 "$old_pid" 2>/dev/null || true
    fi
  fi

  rm -f "$PID_FILE"
}

require_runtime_dependencies() {
  if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    echo "未找到 Python 运行时: $PYTHON_BIN"
    exit 1
  fi

  if ! "$PYTHON_BIN" -c "import uvicorn" >/dev/null 2>&1; then
    echo "当前 Python 环境未安装 uvicorn，请先安装后端依赖。"
    exit 1
  fi
}

ensure_port_is_available() {
  local listening_pids
  listening_pids="$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$listening_pids" ]]; then
    echo "端口 $APP_PORT 已被其他进程占用："
    echo "$listening_pids"
    echo "请先释放端口，或通过 APP_PORT 指定新的监听端口。"
    exit 1
  fi
}

wait_for_health() {
  echo "等待服务健康检查通过..."
  for _ in {1..30}; do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "后端进程在健康检查通过前已退出，请检查日志: $LOG_FILE"
      return 1
    fi
    if curl --silent --fail "$HEALTH_URL" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "构建前端静态资源..."
cd "$SCRIPT_DIR"
npm run build

stop_existing_service
require_runtime_dependencies
ensure_port_is_available

echo "启动后端服务..."
cd "$BACKEND_DIR"
nohup env \
  APP_PUBLIC_BASE_URL="$APP_PUBLIC_BASE_URL" \
  SERVE_FRONTEND=true \
  "$PYTHON_BIN" -m uvicorn app.main:app \
  --host "$APP_HOST" \
  --port "$APP_PORT" \
  --workers "$APP_WORKERS" \
  >"$LOG_FILE" 2>&1 &

BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"

sleep 1
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "后端进程启动后立即退出，请检查日志: $LOG_FILE"
  exit 1
fi

if ! wait_for_health; then
  echo "服务启动失败，请检查日志: $LOG_FILE"
  exit 1
fi

echo ""
echo "部署完成"
echo "应用地址: $APP_PUBLIC_BASE_URL"
echo "API 文档: $APP_PUBLIC_BASE_URL/docs"
echo "后端日志: $LOG_FILE"
echo "停止命令: $SCRIPT_DIR/stop.sh"
