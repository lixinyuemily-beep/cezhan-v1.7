# 策展智能助手后端

基于 FastAPI 的后端服务，连接 Supabase 数据库和元景大模型平台。

## 项目结构

```
backend/
├── app/
│   ├── config.py          # 配置文件
│   ├── main.py            # FastAPI 主入口，同时可托管前端 dist
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py     # Pydantic 数据模型
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── projects.py    # 项目 API
│   │   ├── exhibits.py    # 展品 API
│   │   ├── ai.py          # AI API
│   │   └── auth.py        # 邮箱验证码登录 API
│   └── services/
│       ├── __init__.py
│       ├── database.py                    # Supabase Client 统一入口
│       ├── database_projects_service.py   # 项目域数据库服务
│       ├── database_exhibits_service.py   # 展品域数据库服务
│       ├── database_auth_service.py       # 认证域数据库服务
│       ├── ai_service.py                  # 大模型能力
│       ├── exhibit_import_service.py      # Excel/CSV 展品导入与解析任务
│       ├── storage_service.py             # Supabase Storage 文件服务
│       ├── request_user_service.py        # 当前请求用户解析
│       ├── session_service.py             # 登录态签发与校验
│       ├── email_service.py               # 邮件验证码发送
│       └── sms_service.py                 # 短信能力预留/接入
├── .env.example           # 环境变量示例
├── requirements.txt       # Python 依赖
├── init_db.py             # 数据库初始化脚本
├── *_migration.sql        # 数据表与字段迁移脚本
└── README.md
```

## 当前分层约定

- `routers/` 只处理 HTTP 参数、鉴权和错误响应，不直接访问不相关领域的数据库能力。
- `services/database.py` 只负责提供 Supabase Client，不再提供聚合 `db.xxx()` 接口。
- 数据库访问按业务域拆分：
  - `database_projects_service.py` -> `projects_db`
  - `database_exhibits_service.py` -> `exhibits_db`
  - `database_auth_service.py` -> `auth_db`
- 新代码请直接从具体模块导入 service，例如：

```python
from ..services.ai_service import ai_service
from ..services.database_projects_service import projects_db
```

- `services/__init__.py` 仅作为包说明，不再作为统一导出入口。

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Supabase 配置
SUPABASE_URL=你的Supabase项目URL
SUPABASE_KEY=你的Supabase服务密钥
SUPABASE_STORAGE_BUCKET=exhibit-imports
SUPABASE_STORAGE_IMPORT_PREFIX=imports
SUPABASE_STORAGE_PUBLIC=true

# DeepSeek AI 配置
DEEPSEEK_API_KEY=你的DeepSeek API密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

# 应用配置
DEBUG=true
APP_PUBLIC_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8000
SERVE_FRONTEND=true
FRONTEND_DIST_DIR=../dist

# 鉴权配置
AUTH_TOKEN_SECRET=请替换为生产环境安全密钥
AUTH_TOKEN_EXPIRES_SECONDS=259200
EMAIL_CODE_EXPIRES_MINUTES=5
EMAIL_PROVIDER=mock
EMAIL_DEBUG_RETURN_CODE=true

# SMTP（如需真实发信）
SMTP_HOST=
SMTP_PORT=465
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=策展智能助手
SMTP_USE_TLS=false
SMTP_USE_SSL=true
```

### 3. 初始化数据库

推荐在 Supabase SQL 编辑器中按下面顺序执行：

1. 先创建基础业务表
2. 再执行仓库内的迁移脚本，补齐认证、用户隔离和展品图片字段

基础建表 SQL 示例：

```sql
create extension if not exists pgcrypto;

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    theme TEXT,
    narrative JSONB,
    narrative_options JSONB,
    llm_params JSONB,
    step INTEGER DEFAULT 1,
    status TEXT DEFAULT 'in_progress',
    exhibit_count INTEGER DEFAULT 0,
    selected_narrative INTEGER,
    exhibition_title TEXT,
    uploaded_exhibits JSONB,
    units JSONB,
    kept_exhibits JSONB,
    text_sections JSONB,
    exhibit_confirmations JSONB,
    time TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 单元表
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    theme TEXT,
    items INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 展品表
CREATE TABLE IF NOT EXISTS exhibits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    time TEXT,
    place TEXT,
    material TEXT,
    introduction TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    storage_bucket TEXT,
    storage_path TEXT,
    thumbnail_storage_path TEXT,
    other TEXT,
    weight INTEGER,
    source TEXT,
    confidence INTEGER,
    kept BOOLEAN DEFAULT TRUE,
    manual BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 已完成项目归档表
CREATE TABLE IF NOT EXISTS completed_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL,
    narrative_title TEXT,
    units JSONB,
    text_sections JSONB,
    kept_exhibits JSONB,
    exhibition_title TEXT,
    narrative JSONB,
    narrative_options JSONB,
    selected_narrative INTEGER,
    llm_params JSONB,
    uploaded_exhibits JSONB,
    exhibit_confirmations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 文本段落表
CREATE TABLE IF NOT EXISTS text_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT,
    "order" INTEGER DEFAULT 0,
    is_ai BOOLEAN DEFAULT TRUE,
    edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 自建认证相关表
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user',
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 常用索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_exhibits_user_id ON exhibits(user_id);
CREATE INDEX IF NOT EXISTS idx_exhibits_user_project_id ON exhibits(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_completed_projects_user_id ON completed_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_email_codes_email_created_at
ON email_verification_codes(email, created_at DESC);

-- 开发环境可开启宽松 RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibits ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_projects ENABLE ROW LEVEL SECURITY;

-- RLS 策略（开发环境允许所有操作）
CREATE POLICY "Allow all" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON exhibits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON text_sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON completed_projects FOR ALL USING (true) WITH CHECK (true);
```

然后执行仓库中的迁移脚本：

```sql
-- 1. 自建认证相关表与索引
\i supabase_user_profiles.sql

-- 2. completed_projects 用户隔离字段与索引
\i completed_projects_user_isolation_migration.sql

-- 3. exhibits 新版模板字段
\i exhibits_template_migration.sql

-- 4. exhibits 用户与存储字段
\i exhibits_user_assets_migration.sql
```

如果你的 Supabase SQL 编辑器不支持 `\i`，就把这些 `.sql` 文件内容复制进去依次执行。

### 4. 启动服务

```bash
# 开发模式
uvicorn app.main:app --reload --port 8000

# 或直接运行
python -m uvicorn app.main:app --reload --port 8000
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc

### 5. 服务分工

- `projects.py`
  - 项目、单元、文本段落、完成项目
- `exhibits.py`
  - 展品 CRUD、知识库搜索、批量导入、解析任务状态
- `auth.py`
  - 邮箱验证码发送、验证码校验、当前登录态校验
- `ai.py`
  - 叙事方向、单元结构、展品推荐、文本生成、序言/尾声、大纲生成

## 前端集成与部署

### 开发模式

- 前端默认通过 Vite 代理转发到后端，无需在构建时写死 `VITE_API_BASE_URL`
- 启动后端：

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

- 启动前端：

```bash
cd ..
npm install
npm run dev
```

- 如果后端不是运行在 `http://localhost:8000`，可以在根目录 `.env` 中设置：

```env
VITE_DEV_API_PROXY_TARGET=http://localhost:9000
```

### 生产模式

- 生产环境推荐由 FastAPI 统一托管前端 `dist/` 静态资源
- 执行根目录脚本后，应用和 API 会共用同一个域名与端口

```bash
./deploy.sh
```

- 停止服务：

```bash
./stop.sh
```

- 可选环境变量：

```env
APP_PORT=8000
APP_WORKERS=2
APP_PUBLIC_BASE_URL=http://your-host:8000
SERVE_FRONTEND=true
FRONTEND_DIST_DIR=/absolute/path/to/dist
```

## API 端点

### 项目 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/projects` | 获取项目列表 |
| GET | `/projects/{project_id}` | 获取单个项目 |
| POST | `/projects` | 创建项目 |
| PUT | `/projects/{project_id}` | 更新项目 |
| DELETE | `/projects/{project_id}` | 删除项目 |
| GET | `/projects/{project_id}/units` | 获取项目单元 |
| POST | `/projects/units` | 创建单元 |
| PUT | `/projects/units/{unit_id}` | 更新单元 |
| DELETE | `/projects/units/{unit_id}` | 删除单元 |
| GET | `/projects/{project_id}/text-sections` | 获取项目文本段落 |
| POST | `/projects/text-sections` | 创建文本段落 |
| PUT | `/projects/text-sections/{section_id}` | 更新文本段落 |
| DELETE | `/projects/text-sections/{section_id}` | 删除文本段落 |
| POST | `/projects/{project_id}/complete` | 完成项目并归档 |
| GET | `/projects/completed/list` | 获取完成项目列表 |
| GET | `/projects/completed/{project_id}` | 获取完成项目详情 |
| DELETE | `/projects/completed/{project_id}` | 删除完成项目 |

### 展品 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/exhibits` | 获取展品列表 |
| GET | `/exhibits/all` | 获取当前用户展品知识库 |
| DELETE | `/exhibits/all` | 清空当前用户展品 |
| GET | `/exhibits/search` | 搜索展品 |
| POST | `/exhibits/parse-template` | 上传并解析固定模板 |
| GET | `/exhibits/parse-template-tasks/{task_id}` | 查询解析任务状态 |
| GET | `/exhibits/{exhibit_id}` | 获取单个展品 |
| POST | `/exhibits` | 创建展品 |
| PUT | `/exhibits/{exhibit_id}` | 更新展品 |
| DELETE | `/exhibits/{exhibit_id}` | 删除展品 |
| POST | `/exhibits/batch` | 批量创建展品 |

### AI API

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/ai/narrative` | 生成叙事方向 |
| POST | `/ai/units` | 生成单元结构 |
| POST | `/ai/recommend` | 推荐展品 |
| POST | `/ai/recommend-batch` | 批量推荐展品 |
| POST | `/ai/text-section` | 生成文本内容 |
| POST | `/ai/preface` | 生成展览序言 |
| POST | `/ai/epilogue` | 生成展览尾声 |
| POST | `/ai/outline` | 生成展览大纲 |
| GET | `/ai/health` | AI 服务健康检查 |

### 认证 API

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/auth/send-code` | 发送邮箱验证码 |
| POST | `/auth/verify-code` | 校验验证码并登录 |
| GET | `/auth/me` | 获取当前登录用户 |

## 连接前端

默认情况下，前端在生产环境会使用同源地址访问 API；开发环境由 Vite 代理负责转发。
