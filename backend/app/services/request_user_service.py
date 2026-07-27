"""
请求用户解析服务
"""
from typing import Optional

from fastapi import HTTPException

from .session_service import SessionService


class RequestUserService:
    """统一解析请求里的登录用户和显式 user_id。"""

    @staticmethod
    def _normalize_user_id(user_id: Optional[str]) -> Optional[str]:
        value = str(user_id or "").strip()
        return value or None

    @classmethod
    def get_authenticated_user_id(cls, authorization: Optional[str]) -> Optional[str]:
        header = str(authorization or "").strip()
        if not header:
            return None
        if not header.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="未提供有效的登录凭证")

        token = header.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="登录凭证为空")

        payload = SessionService.verify_access_token(token)
        return cls._normalize_user_id(payload.get("sub"))

    @classmethod
    def resolve_user_id(
        cls,
        provided_user_id: Optional[str],
        authorization: Optional[str],
        *,
        required: bool = False,
    ) -> Optional[str]:
        normalized_provided = cls._normalize_user_id(provided_user_id)
        authenticated_user_id = cls.get_authenticated_user_id(authorization)

        if authenticated_user_id and normalized_provided and normalized_provided != authenticated_user_id:
            raise HTTPException(status_code=403, detail="不能访问其他用户的数据")

        effective_user_id = authenticated_user_id or normalized_provided
        if required and not effective_user_id:
            raise HTTPException(status_code=400, detail="缺少 user_id")
        return effective_user_id


request_user_service = RequestUserService()
