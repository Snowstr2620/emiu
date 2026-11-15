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
  viewer_passcode_enabled boolean not null default false,
  viewer_passcode_hash text not null default '',
  updated_at timestamptz not null default now()
);

-- 2. Bảng các mốc ảnh kỷ niệm
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  memory_date date not null,
  title text not null default '',
  story text not null,
  image_url text not null,
  image_alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_memories_sort_order
  on public.memories (sort_order asc, memory_date asc, created_at asc);

-- Bật Row Level Security: không cấp quyền ghi/đọc công khai trực tiếp qua anon key;
-- toàn bộ truy vấn đều đi qua Next.js Server API dùng SUPABASE_SERVICE_ROLE_KEY
-- (để bảo vệ viewer_passcode_hash và quyền chỉnh sửa /admin).
alter table public.site_settings enable row level security;
alter table public.memories enable row level security;

-- 3. Bucket lưu ảnh kỷ niệm & nhạc nền (15MB max, public read, write chỉ qua Signed Upload URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'love-memories',
  'love-memories',
  true,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
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
