"""
自建会话服务
"""
import base64
import hashlib
import hmac
import json
import time
from typing import Dict

from fastapi import HTTPException

from ..config import settings


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}")


class SessionService:
    """使用 HMAC-SHA256 生成和校验应用登录态。"""

    @staticmethod
    def _get_secret() -> bytes:
        secret = settings.auth_token_secret.strip()
        if not secret:
            raise HTTPException(status_code=500, detail="AUTH_TOKEN_SECRET 未配置")
        return secret.encode("utf-8")

    @classmethod
    def create_access_token(cls, user: Dict) -> Dict:
        now = int(time.time())
        expires_in = settings.auth_token_expires_seconds
        payload = {
            "sub": user["id"],
            "email": user.get("email"),
            "phone": user.get("phone"),
            "type": "access",
            "iat": now,
            "exp": now + expires_in,
        }
        header = {"alg": "HS256", "typ": "JWT"}
        signing_input = ".".join([
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ])
        signature = hmac.new(
            cls._get_secret(),
            signing_input.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        token = f"{signing_input}.{_b64url_encode(signature)}"
        return {
            "access_token": token,
            "refresh_token": None,
            "expires_in": expires_in,
            "expires_at": payload["exp"],
            "token_type": "bearer",
        }

    @classmethod
    def verify_access_token(cls, token: str) -> Dict:
        try:
            header_segment, payload_segment, signature_segment = token.split(".")
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="登录凭证格式不正确") from exc

        signing_input = f"{header_segment}.{payload_segment}"
        expected_signature = hmac.new(
            cls._get_secret(),
            signing_input.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        received_signature = _b64url_decode(signature_segment)
        if not hmac.compare_digest(expected_signature, received_signature):
            raise HTTPException(status_code=401, detail="登录凭证无效")

        try:
            payload = json.loads(_b64url_decode(payload_segment))
        except Exception as exc:
            raise HTTPException(status_code=401, detail="登录凭证解析失败") from exc

        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="登录凭证类型不正确")

        if int(payload.get("exp", 0)) <= int(time.time()):
            raise HTTPException(status_code=401, detail="登录状态已过期")

        return payload
