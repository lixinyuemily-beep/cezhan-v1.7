"""
数据库入口 - 仅负责提供 Supabase Client。

说明：
- 新代码请直接使用各业务域数据库服务：
  - `projects_db`
  - `exhibits_db`
  - `auth_db`
- 本模块不再提供聚合 `db.xxx()` 接口。
"""
from typing import Optional

from supabase import Client, create_client

from ..config import settings


class DatabaseClientProvider:
    """统一管理 Supabase Client 的生命周期。"""

    _instance: Optional[Client] = None

    @classmethod
    def get_client(cls) -> Client:
        if cls._instance is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise ValueError("Supabase URL 和 Key 未配置")
            cls._instance = create_client(settings.supabase_url, settings.supabase_key)
        return cls._instance

    @classmethod
    def reset_client(cls):
        cls._instance = None


def get_supabase_client() -> Client:
    """函数式入口，便于非类场景复用。"""
    return DatabaseClientProvider.get_client()
