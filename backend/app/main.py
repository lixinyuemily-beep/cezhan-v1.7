"""
FastAPI 主入口 - 策展智能助手 API
"""
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import projects, exhibits, ai, auth

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.app_name,
    description="策展智能助手后端API - 提供项目管理、展品筛选、AI生成等功能",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path(settings.exhibit_import_static_dir).mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/imports",
    StaticFiles(directory=settings.exhibit_import_static_dir),
    name="import-assets",
)

FRONTEND_DIST_DIR = Path(settings.frontend_dist_dir)

# 注册路由
app.include_router(projects.router)
app.include_router(exhibits.router)
app.include_router(ai.router)
app.include_router(auth.router)


def _frontend_index_file() -> Path:
    return FRONTEND_DIST_DIR / "index.html"


def _frontend_enabled() -> bool:
    return settings.serve_frontend and _frontend_index_file().exists()


def _resolve_frontend_asset(relative_path: str) -> Optional[Path]:
    requested_path = (FRONTEND_DIST_DIR / relative_path).resolve()
    try:
        requested_path.relative_to(FRONTEND_DIST_DIR.resolve())
    except ValueError:
        return None
    return requested_path


@app.get("/api-info")
async def api_info():
    """API 信息"""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/")
async def root():
    """根路径 - 优先返回前端页面，未构建时返回 API 信息"""
    if _frontend_enabled():
        return FileResponse(_frontend_index_file())
    return await api_info()


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "database": "supabase",
        "ai": "deepseek",
        "model": settings.deepseek_model,
        "supabase_url": settings.supabase_url
    }


@app.get("/{full_path:path}", include_in_schema=False)
async def frontend_router(full_path: str):
    """生产环境托管前端静态资源，并为前端路由回退到 index.html。"""
    if not _frontend_enabled():
        raise HTTPException(status_code=404, detail="Not Found")

    requested_file = _resolve_frontend_asset(full_path)
    if requested_file and requested_file.is_file():
        return FileResponse(requested_file)
    return FileResponse(_frontend_index_file())


# 启动提示
if __name__ == "__main__":
    import uvicorn
    print(f"🚀 启动 {settings.app_name}")
    print(f"📚 API 文档: {settings.app_public_base_url}/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
