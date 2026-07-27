"""
认证域数据库服务 - 应用用户与邮箱验证码
"""
from datetime import datetime, timezone
from typing import Dict, Optional

from ..config import settings
from .database import DatabaseClientProvider


class AuthDatabaseService(DatabaseClientProvider):
    """认证域相关的数据访问能力。"""

    @classmethod
    def get_app_user_by_phone(cls, phone: str) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_app_users).select("*").eq("phone", phone).limit(1).execute()
        return result.data[0] if result.data else None

    @classmethod
    def get_app_user_by_email(cls, email: str) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_app_users).select("*").eq("email", email).limit(1).execute()
        return result.data[0] if result.data else None

    @classmethod
    def get_app_user_by_id(cls, user_id: str) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_app_users).select("*").eq("id", user_id).limit(1).execute()
        return result.data[0] if result.data else None

    @classmethod
    def create_app_user(cls, user_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_app_users).insert(user_data).execute()
        return result.data[0] if result.data else None

    @classmethod
    def update_app_user(cls, user_id: str, user_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_app_users).update(user_data).eq("id", user_id).execute()
        return result.data[0] if result.data else None

    @classmethod
    def create_email_verification_code(cls, code_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_email_verification_codes).insert(code_data).execute()
        return result.data[0] if result.data else None

    @classmethod
    def get_latest_email_verification_code(cls, email: str) -> Optional[Dict]:
        client = cls.get_client()
        result = (
            client.table(settings.table_email_verification_codes)
            .select("*")
            .eq("email", email)
            .is_("used_at", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    @classmethod
    def mark_email_verification_code_used(cls, code_id: str) -> Optional[Dict]:
        client = cls.get_client()
        result = (
            client.table(settings.table_email_verification_codes)
            .update({"used_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", code_id)
            .execute()
        )
        return result.data[0] if result.data else None


auth_db = AuthDatabaseService()
