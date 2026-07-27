"""
认证 API 路由
"""
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from ..config import settings
from ..models.schemas import EmailAuthRequest, EmailOtpVerifyRequest
from ..services.database_auth_service import auth_db
from ..services.email_service import email_service
from ..services.session_service import SessionService

router = APIRouter(prefix="/auth", tags=["认证"])


def normalize_email(email: str) -> str:
    cleaned = str(email or "").strip().lower()
    if not cleaned:
        raise HTTPException(status_code=400, detail="请输入邮箱")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", cleaned):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    return cleaned


def hash_verification_code(email: str, code: str) -> str:
    raw = f"{email}:{code}:{settings.auth_token_secret}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = str(value).replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def serialize_user(user: dict):
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "phone": user.get("phone"),
        "display_name": user.get("display_name"),
    }


def build_auth_response(user: dict, message: Optional[str] = None):
    return {
        "user": serialize_user(user),
        "session": SessionService.create_access_token(user),
        "message": message,
    }


@router.post("/send-code")
async def send_code(payload: EmailAuthRequest):
    """发送邮箱验证码，后端自行存储验证码和登录态。"""
    try:
        email = normalize_email(payload.email)
        code = f"{secrets.randbelow(1000000):06d}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.email_code_expires_minutes)
        auth_db.create_email_verification_code({
            "email": email,
            "code_hash": hash_verification_code(email, code),
            "expires_at": expires_at.isoformat(),
        })

        send_result = email_service.send_verification_code(email, code)
        response = {
            "success": True,
            "email": email,
            "message": "验证码已发送，请注意查收邮件",
        }
        if send_result.get("debug_code"):
            response["debug_code"] = send_result["debug_code"]
            response["message"] = "开发环境验证码已生成"
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-code")
async def verify_code(payload: EmailOtpVerifyRequest):
    """校验邮箱验证码并完成登录。"""
    try:
        email = normalize_email(payload.email)
        code = str(payload.code or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="请输入验证码")

        latest_code = auth_db.get_latest_email_verification_code(email)
        if not latest_code:
            raise HTTPException(status_code=400, detail="请先获取验证码")

        expires_at = parse_datetime(latest_code.get("expires_at"))
        if not expires_at or expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")

        if latest_code.get("code_hash") != hash_verification_code(email, code):
            raise HTTPException(status_code=400, detail="验证码不正确")

        auth_db.mark_email_verification_code_used(latest_code["id"])

        now = datetime.now(timezone.utc).isoformat()
        user = auth_db.get_app_user_by_email(email)
        if user:
            user = auth_db.update_app_user(user["id"], {"email": email, "last_sign_in_at": now})
        else:
            email_name = email.split("@", 1)[0][:20] or "用户"
            user = auth_db.create_app_user({
                "email": email,
                "display_name": email_name,
                "last_sign_in_at": now,
            })

        if not user:
            raise HTTPException(status_code=500, detail="登录成功，但用户信息写入失败")

        return build_auth_response(user, message="登录成功")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    """校验当前登录态并返回用户信息"""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="未提供有效的登录凭证")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="登录凭证为空")

    try:
        payload = SessionService.verify_access_token(token)
        user = auth_db.get_app_user_by_id(payload.get("sub"))
        if not user:
            raise HTTPException(status_code=401, detail="登录状态已失效")
        return {"user": serialize_user(user)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
