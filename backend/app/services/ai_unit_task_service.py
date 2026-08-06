"""跨 Uvicorn worker 可查询的单元结构后台任务。"""
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from ..config import settings


class AIUnitTaskService:
    def __init__(self) -> None:
        self.task_dir = Path(settings.ai_unit_task_dir)
        self.task_dir.mkdir(parents=True, exist_ok=True)

    def _task_path(self, task_id: str) -> Path:
        normalized = str(task_id or "").strip()
        try:
            normalized = str(uuid.UUID(normalized))
        except (ValueError, AttributeError):
            raise FileNotFoundError("单元结构生成任务不存在或已过期")
        return self.task_dir / f"{normalized}.json"

    def _write(self, task_id: str, payload: Dict[str, Any]) -> None:
        path = self._task_path(task_id)
        temporary_path = path.with_suffix(f".{os.getpid()}.tmp")
        temporary_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        temporary_path.replace(path)

    def create(self) -> Dict[str, Any]:
        task_id = str(uuid.uuid4())
        now = time.time()
        task = {
            "task_id": task_id,
            "status": "pending",
            "created_at": now,
            "updated_at": now,
            "result": None,
            "error": None,
        }
        self._write(task_id, task)
        self.cleanup()
        return task

    def mark_running(self, task_id: str) -> None:
        task = self.get(task_id) or {"task_id": task_id, "created_at": time.time()}
        task.update({"status": "running", "updated_at": time.time(), "error": None})
        self._write(task_id, task)

    def mark_success(self, task_id: str, units: Any) -> None:
        task = self.get(task_id) or {"task_id": task_id, "created_at": time.time()}
        task.update({
            "status": "success",
            "updated_at": time.time(),
            "result": {"units": units},
            "error": None,
        })
        self._write(task_id, task)

    def mark_failed(self, task_id: str, error: Exception) -> None:
        task = self.get(task_id) or {"task_id": task_id, "created_at": time.time()}
        task.update({
            "status": "failed",
            "updated_at": time.time(),
            "result": None,
            "error": str(error) or "单元结构生成失败",
        })
        self._write(task_id, task)

    def get(self, task_id: str) -> Optional[Dict[str, Any]]:
        path = self._task_path(task_id)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    def cleanup(self, max_age_seconds: int = 24 * 60 * 60) -> None:
        cutoff = time.time() - max_age_seconds
        for path in self.task_dir.glob("*.json"):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink()
            except OSError:
                continue


ai_unit_task_service = AIUnitTaskService()
