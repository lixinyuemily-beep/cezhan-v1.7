"""
短信发送服务
"""
import json
from typing import Dict

from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
from alibabacloud_dysmsapi20170525 import models as dysms_models
from alibabacloud_tea_openapi import models as open_api_models

from ..config import settings


class SmsService:
    """短信服务抽象，支持开发环境 mock 和阿里云短信。"""

    @staticmethod
    def _normalize_aliyun_phone(phone: str) -> str:
        normalized = str(phone or "").strip()
        if normalized.startswith("+86"):
            normalized = normalized[3:]
        elif normalized.startswith("86") and len(normalized) == 13:
            normalized = normalized[2:]
        return normalized

    @staticmethod
    def _create_aliyun_client() -> DysmsapiClient:
        if not settings.aliyun_sms_access_key_id or not settings.aliyun_sms_access_key_secret:
            raise RuntimeError("阿里云短信未配置 AccessKey")
        config = open_api_models.Config(
            access_key_id=settings.aliyun_sms_access_key_id,
            access_key_secret=settings.aliyun_sms_access_key_secret,
            endpoint="dysmsapi.aliyuncs.com",
        )
        return DysmsapiClient(config)

    @classmethod
    def send_verification_code(cls, phone: str, code: str) -> Dict:
        provider = settings.sms_provider.lower()
        if provider == "mock":
            print(f"[SMS MOCK] phone={phone}, code={code}")
            return {
                "provider": "mock",
                "debug_code": code if settings.debug and settings.sms_debug_return_code else None,
            }

        if provider == "aliyun":
            if not settings.aliyun_sms_sign_name or not settings.aliyun_sms_template_code:
                raise RuntimeError("阿里云短信未配置签名或模板")

            client = cls._create_aliyun_client()
            request = dysms_models.SendSmsRequest(
                phone_numbers=cls._normalize_aliyun_phone(phone),
                sign_name=settings.aliyun_sms_sign_name,
                template_code=settings.aliyun_sms_template_code,
                template_param=json.dumps({"code": code}, ensure_ascii=False),
            )
            response = client.send_sms(request)
            body = response.body
            if getattr(body, "code", "") != "OK":
                raise RuntimeError(getattr(body, "message", "") or "阿里云短信发送失败")
            return {
                "provider": "aliyun",
                "biz_id": getattr(body, "biz_id", None),
                "message": "验证码已发送",
            }

        raise RuntimeError(
            f"当前短信通道 `{settings.sms_provider}` 尚未接入，请先使用 mock 或补充第三方短信实现"
        )


sms_service = SmsService()
