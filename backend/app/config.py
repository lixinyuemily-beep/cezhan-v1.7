"""
配置文件 - 管理所有环境变量和配置
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
load_dotenv(BACKEND_ROOT / ".env")


class Settings(BaseSettings):
    # Supabase 配置 (使用 service role key，服务端安全连接)
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_KEY", "")
    supabase_storage_bucket: str = os.getenv("SUPABASE_STORAGE_BUCKET", "exhibit-imports")
    supabase_storage_import_prefix: str = os.getenv("SUPABASE_STORAGE_IMPORT_PREFIX", "imports")
    supabase_storage_public: bool = os.getenv("SUPABASE_STORAGE_PUBLIC", "true").lower() == "true"

    # DeepSeek AI 配置 (OpenAI 兼容接口)
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    deepseek_model: str = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

    # FastAPI配置
    app_name: str = "策展智能助手 API"
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    cors_origins: list = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:5174,http://localhost:8000",
        ).split(",")
        if origin.strip()
    ]
    app_public_base_url: str = os.getenv("APP_PUBLIC_BASE_URL", "http://localhost:8000")
    serve_frontend: bool = os.getenv("SERVE_FRONTEND", "true").lower() == "true"
    frontend_dist_dir: str = os.getenv("FRONTEND_DIST_DIR", str(PROJECT_ROOT / "dist"))

    # 自建认证配置
    auth_token_secret: str = os.getenv("AUTH_TOKEN_SECRET", "change-me-in-production")
    auth_token_expires_seconds: int = int(os.getenv("AUTH_TOKEN_EXPIRES_SECONDS", "259200"))
    email_code_expires_minutes: int = int(os.getenv("EMAIL_CODE_EXPIRES_MINUTES", "5"))
    email_provider: str = os.getenv("EMAIL_PROVIDER", "mock")
    email_debug_return_code: bool = os.getenv("EMAIL_DEBUG_RETURN_CODE", "true").lower() == "true"
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "")
    smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "策展智能助手")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
    smtp_use_ssl: bool = os.getenv("SMTP_USE_SSL", "true").lower() == "true"
    aliyun_sms_access_key_id: str = os.getenv("ALIYUN_SMS_ACCESS_KEY_ID", "")
    aliyun_sms_access_key_secret: str = os.getenv("ALIYUN_SMS_ACCESS_KEY_SECRET", "")
    aliyun_sms_sign_name: str = os.getenv("ALIYUN_SMS_SIGN_NAME", "")
    aliyun_sms_template_code: str = os.getenv("ALIYUN_SMS_TEMPLATE_CODE", "")

    # 数据库表名
    table_projects: str = "projects"
    table_exhibits: str = "exhibits"
    table_text_sections: str = "text_sections"
    table_units: str = "units"
    table_completed_projects: str = "completed_projects"
    table_project_versions: str = "project_versions"
    table_app_users: str = "app_users"
    table_email_verification_codes: str = "email_verification_codes"

    # 展品导入配置
    exhibit_import_max_upload_size_mb: int = int(os.getenv("EXHIBIT_IMPORT_MAX_UPLOAD_SIZE_MB", "360"))
    exhibit_import_task_concurrency: int = int(os.getenv("EXHIBIT_IMPORT_TASK_CONCURRENCY", "1"))
    exhibit_import_temp_dir: str = os.getenv(
        "EXHIBIT_IMPORT_TEMP_DIR",
        str(BACKEND_ROOT / "storage" / "import_jobs"),
    )
    exhibit_import_static_dir: str = os.getenv(
        "EXHIBIT_IMPORT_STATIC_DIR",
        str(BACKEND_ROOT / "storage" / "import_assets"),
    )

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
