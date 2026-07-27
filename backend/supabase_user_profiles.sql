-- 自建认证：应用用户表 + 邮箱验证码表
-- 不依赖 Supabase Auth，由后端自行发送和校验邮箱验证码

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table if not exists public.app_users (
    id uuid primary key default gen_random_uuid(),
    phone text unique,
    email text unique,
    display_name text,
    avatar_url text,
    bio text,
    role text default 'user',
    last_sign_in_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.app_users add column if not exists phone text;
alter table public.app_users add column if not exists email text;
alter table public.app_users add column if not exists display_name text;
alter table public.app_users add column if not exists avatar_url text;
alter table public.app_users add column if not exists bio text;
alter table public.app_users add column if not exists role text default 'user';
alter table public.app_users add column if not exists last_sign_in_at timestamptz;
alter table public.app_users add column if not exists created_at timestamptz default now();
alter table public.app_users add column if not exists updated_at timestamptz default now();
alter table public.app_users alter column phone drop not null;

create unique index if not exists idx_app_users_phone on public.app_users(phone);
create index if not exists idx_app_users_email on public.app_users(email);

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

create table if not exists public.email_verification_codes (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz default now()
);

alter table public.email_verification_codes add column if not exists email text;
alter table public.email_verification_codes add column if not exists code_hash text;
alter table public.email_verification_codes add column if not exists expires_at timestamptz;
alter table public.email_verification_codes add column if not exists used_at timestamptz;
alter table public.email_verification_codes add column if not exists created_at timestamptz default now();

create index if not exists idx_email_codes_email_created_at
on public.email_verification_codes(email, created_at desc);

create index if not exists idx_email_codes_expires_at
on public.email_verification_codes(expires_at);
