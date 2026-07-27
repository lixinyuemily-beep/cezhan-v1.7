"""
Supabase Storage 服务
"""
import threading
from typing import Iterable, List

from storage3.types import CreateOrUpdateBucketOptions, FileOptions

from ..config import settings
from .database import DatabaseClientProvider


class StorageService:
    """封装 Supabase Storage 的桶管理和文件上传。"""

    _bucket_ready = False
    _bucket_lock = threading.Lock()

    @classmethod
    def _bucket_name(cls) -> str:
        bucket = str(settings.supabase_storage_bucket or "").strip()
        if not bucket:
            raise ValueError("SUPABASE_STORAGE_BUCKET 未配置")
        return bucket

    @classmethod
    def ensure_bucket_ready(cls) -> None:
        if cls._bucket_ready:
            return

        with cls._bucket_lock:
            if cls._bucket_ready:
                return

            client = DatabaseClientProvider.get_client()
            bucket_name = cls._bucket_name()
            options = CreateOrUpdateBucketOptions(public=settings.supabase_storage_public)

            try:
                client.storage.get_bucket(bucket_name)
            except Exception:
                client.storage.create_bucket(bucket_name, options=options)
            else:
                client.storage.update_bucket(bucket_name, options)

            cls._bucket_ready = True

    @classmethod
    def upload_bytes(cls, path: str, content: bytes, content_type: str) -> str:
        cls.ensure_bucket_ready()
        client = DatabaseClientProvider.get_client()
        normalized_path = str(path or "").strip().lstrip("/")
        if not normalized_path:
            raise ValueError("Storage path 不能为空")

        client.storage.from_(cls._bucket_name()).upload(
            normalized_path,
            content,
            file_options=FileOptions(content_type=content_type, upsert="true"),
        )
        return client.storage.from_(cls._bucket_name()).get_public_url(normalized_path)

    @classmethod
    def build_import_asset_path(cls, user_id: str, task_id: str, filename: str) -> str:
        prefix = str(settings.supabase_storage_import_prefix or "").strip().strip("/")
        normalized_user_id = str(user_id or "").strip()
        parts = [part for part in (prefix, normalized_user_id, task_id, filename) if part]
        return "/".join(parts)

    @classmethod
    def remove_files(cls, paths: Iterable[str]) -> None:
        normalized_paths: List[str] = [str(path).strip().lstrip("/") for path in paths if str(path).strip()]
        if not normalized_paths:
            return

        try:
            cls.ensure_bucket_ready()
            DatabaseClientProvider.get_client().storage.from_(cls._bucket_name()).remove(normalized_paths)
        except Exception:
            # 清理失败不影响主流程，只避免额外抛错覆盖原始异常。
            return


storage_service = StorageService()
