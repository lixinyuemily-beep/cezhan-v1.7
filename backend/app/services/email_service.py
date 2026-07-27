"""
邮件发送服务
"""
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Dict

from ..config import settings


class EmailService:
    """邮件服务抽象，支持开发环境 mock 和 SMTP 真实发信。"""

    @staticmethod
    def _build_message(email: str, code: str) -> MIMEText:
        expires_minutes = settings.email_code_expires_minutes
        body = (
            f"您好，\n\n"
            f"您的登录验证码是：{code}\n"
            f"验证码将在 {expires_minutes} 分钟后失效，请勿泄露给他人。\n\n"
            f"如果这不是您的操作，请忽略这封邮件。\n"
        )
        message = MIMEText(body, "plain", "utf-8")
        message["Subject"] = "策展智能助手登录验证码"
        message["From"] = formataddr((settings.smtp_from_name, settings.smtp_from_email or settings.smtp_username))
        message["To"] = email
        return message

    @classmethod
    def send_verification_code(cls, email: str, code: str) -> Dict:
        provider = settings.email_provider.lower()
        if provider == "mock":
            print(f"[EMAIL MOCK] email={email}, code={code}")
            return {
                "provider": "mock",
                "debug_code": code if settings.debug and settings.email_debug_return_code else None,
            }

        if provider == "smtp":
            if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
                raise RuntimeError("SMTP 配置不完整，请检查 SMTP_HOST、SMTP_USERNAME、SMTP_PASSWORD")

            message = cls._build_message(email, code)
            if settings.smtp_use_ssl:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20)
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)

            try:
                server.ehlo()
                if settings.smtp_use_tls and not settings.smtp_use_ssl:
                    server.starttls()
                    server.ehlo()
                server.login(settings.smtp_username, settings.smtp_password)
                server.sendmail(
                    settings.smtp_from_email or settings.smtp_username,
                    [email],
                    message.as_string(),
                )
            finally:
                try:
                    server.quit()
                except Exception:
                    pass

            return {
                "provider": "smtp",
                "message": "验证码邮件已发送",
            }

        raise RuntimeError(
            f"当前邮件通道 `{settings.email_provider}` 尚未接入，请先使用 mock 或配置 SMTP"
        )


email_service = EmailService()
