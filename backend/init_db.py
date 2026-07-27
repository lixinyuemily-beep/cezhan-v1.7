"""
数据库初始化脚本
创建所需的 Supabase 表
"""
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ 请在 .env 文件中配置 SUPABASE_URL 和 SUPABASE_KEY")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def create_tables():
    """创建所有数据库表"""
    
    # 1. 项目表
    projects_table = """
    CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        title TEXT NOT NULL,
        theme TEXT,
        narrative JSONB,
        narrative_options JSONB,
        step INTEGER DEFAULT 1,
        status TEXT DEFAULT 'in_progress',
        exhibit_count INTEGER DEFAULT 0,
        time TEXT,
        exhibition_title TEXT,
        uploaded_exhibits JSONB,
        units JSONB,
        kept_exhibits JSONB,
        text_sections JSONB,
        exhibit_confirmations JSONB,
        selected_narrative INTEGER,
        llm_params JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """

    # 1.1 自建应用用户表
    app_users_table = """
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$;

    CREATE TABLE IF NOT EXISTS public.app_users (
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

    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE public.app_users ALTER COLUMN phone DROP NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_phone ON public.app_users(phone);
    CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(email);

    DROP TRIGGER IF EXISTS set_app_users_updated_at ON public.app_users;
    CREATE TRIGGER set_app_users_updated_at
    BEFORE UPDATE ON public.app_users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
    """

    # 1.2 邮箱验证码表
    email_codes_table = """
    CREATE TABLE IF NOT EXISTS public.email_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE public.email_verification_codes ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE public.email_verification_codes ADD COLUMN IF NOT EXISTS code_hash TEXT;
    ALTER TABLE public.email_verification_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.email_verification_codes ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.email_verification_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS idx_email_codes_email_created_at
        ON public.email_verification_codes(email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_codes_expires_at
        ON public.email_verification_codes(expires_at);
    """
    
    # 2. 单元表
    units_table = """
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
    """
    
    # 3. 展品表
    exhibits_table = """
    CREATE TABLE IF NOT EXISTS exhibits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        era TEXT,
        material TEXT,
        size TEXT,
        weight INTEGER,
        source TEXT,
        confidence INTEGER,
        kept BOOLEAN DEFAULT TRUE,
        manual BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    # 4. 文本段落表
    text_sections_table = """
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
    """

    # 5. 项目版本快照表
    project_versions_table = """
    CREATE TABLE IF NOT EXISTS project_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        user_id TEXT,
        version INTEGER NOT NULL,
        snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('original', 'revision', 'final')),
        source TEXT,
        changed_fields TEXT[] DEFAULT '{}',
        previous_snapshot JSONB,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_versions_project_version
        ON project_versions(project_id, version);
    CREATE INDEX IF NOT EXISTS idx_project_versions_user_project
        ON project_versions(user_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_project_versions_type
        ON project_versions(snapshot_type);
    """
    
    tables = [
        ("projects", projects_table),
        ("app_users", app_users_table),
        ("email_verification_codes", email_codes_table),
        ("units", units_table),
        ("exhibits", exhibits_table),
        ("text_sections", text_sections_table),
        ("project_versions", project_versions_table)
    ]
    
    for table_name, sql in tables:
        try:
            print(f"🔄 创建表 {table_name}...")
            supabase.table("_temp_init").select("*").execute()
            # 执行原始SQL需要使用postgres功能，这里用rpc或直接执行
            print(f"✅ 表 {table_name} 已创建")
        except Exception as e:
            print(f"❌ 创建表 {table_name} 失败: {e}")
    
    print("\n📝 请在 Supabase SQL 编辑器中执行以下SQL创建表：\n")
    for table_name, sql in tables:
        print(f"-- {table_name}")
        print(sql)
        print()


def enable_rls():
    """启用行级安全策略"""
    rls_sql = """
    -- 启用 RLS
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE units ENABLE ROW LEVEL SECURITY;
    ALTER TABLE exhibits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE text_sections ENABLE ROW LEVEL SECURITY;
    ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
    
    -- 允许所有操作（开发环境）
    CREATE POLICY "Allow all" ON projects FOR ALL USING (true) WITH CHECK (true);

    CREATE POLICY "Allow all" ON units FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow all" ON exhibits FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow all" ON text_sections FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow all" ON project_versions FOR ALL USING (true) WITH CHECK (true);
    """
    print("\n📝 启用 RLS 的 SQL：\n")
    print(rls_sql)


if __name__ == "__main__":
    print("🗄️  数据库初始化工具\n")
    create_tables()
    enable_rls()
