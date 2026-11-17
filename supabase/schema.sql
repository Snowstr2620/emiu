-- =====================================================================
-- Supabase Schema & Storage Security for Website Kỷ Niệm Tình Yêu
-- =====================================================================
-- Chạy toàn bộ file này trong Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

-- 1. Bảng cấu hình chung (chỉ có 1 dòng id = 1)
create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  couple_title text not null,
  hero_subtitle text not null,
  love_start_date date not null,
  music_url text not null default '/samples/gentle-memories.wav',
  music_enabled boolean not null default true,
  letter_title text not null,
  letter_body text not null,
  letter_signature text not null,
  viewer_passcode_enabled boolean not null default true,
  viewer_passcode_hash text not null default '',
  updated_at timestamptz not null default now()
);

-- 2. Bảng các mốc ảnh kỷ niệm (mỗi kỷ niệm là 1 album nhiều ảnh)
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  memory_date date not null,
  title text not null default '',
  story text not null,
  image_url text not null,
  image_alt text not null default '',
  images jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.memories
  add column if not exists images jsonb not null default '[]'::jsonb;

create index if not exists idx_memories_sort_order
  on public.memories (sort_order asc, memory_date asc, created_at asc);

-- 3. Bảng tài khoản phân quyền (Admin & Người thương)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  role text not null check (role in ('admin', 'viewer')),
  password_hash text not null,
  otp_hash text not null,
  otp_hint text not null default '',
  is_active boolean not null default true,
  session_version integer not null default 1,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Bảng nhật ký ra vào và hành động người dùng
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.app_users(id) on delete set null,
  username text not null default 'khach',
  user_role text not null default 'guest' check (user_role in ('admin', 'viewer', 'guest')),
  event_type text not null,
  detail text not null default '',
  device_summary text not null default '',
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at
  on public.activity_logs (created_at desc);

create index if not exists idx_activity_logs_event_username
  on public.activity_logs (event_type, username, created_at desc);

-- 5. Bảng nhật ký mỗi ngày của hai đứa (Daily Couple Diary)
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  title text not null default '',
  content text not null,
  mood text not null default 'loved' check (
    mood in ('loved', 'happy', 'peaceful', 'miss_you', 'grateful', 'excited', 'tired')
  ),
  image_url text not null default '',
  image_alt text not null default '',
  author_id uuid null references public.app_users(id) on delete set null,
  author_username text not null,
  author_display_name text not null,
  author_role text not null check (author_role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diary_entries_entry_date
  on public.diary_entries (entry_date desc, created_at desc);

-- Bật Row Level Security: không cấp quyền ghi/đọc công khai trực tiếp qua anon key;
-- toàn bộ truy vấn đều đi qua Next.js Server API dùng SUPABASE_SERVICE_ROLE_KEY
-- (để bảo vệ password_hash, otp_hash, activity_logs và quyền chỉnh sửa /admin).
alter table public.site_settings enable row level security;
alter table public.memories enable row level security;
alter table public.app_users enable row level security;
alter table public.activity_logs enable row level security;
alter table public.diary_entries enable row level security;

-- 5. Bucket lưu ảnh, video kỷ niệm & nhạc nền (50MB max, public read, write chỉ qua Signed Upload URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'love-memories',
  'love-memories',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Chỉ cho phép đọc công khai (SELECT) các file đã tải lên bucket love-memories.
-- Tuyệt đối KHÔNG mở policy INSERT/UPDATE/DELETE cho anon/public;
-- server cấp Signed Upload URL một lần sau khi xác thực /admin.
drop policy if exists "Public read love-memories" on storage.objects;
create policy "Public read love-memories"
  on storage.objects for select
  using (bucket_id = 'love-memories');
