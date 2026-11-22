-- เปิด SQL Editor ใน Supabase แล้ววางไฟล์นี้เพื่อสร้างตาราง
create table if not exists public.krathongs (
  id bigint generated always as identity primary key,
  name text not null default '' check (char_length(name) <= 24),
  message text not null check (char_length(message) between 1 and 180),
  color text not null default 'gold' check (color in ('gold', 'pink', 'violet', 'green')),
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.krathongs enable row level security;

-- ผู้เข้าชมทั่วไปอ่านได้เฉพาะกระทงที่อนุมัติแล้ว
create policy "Anyone can read approved krathongs"
on public.krathongs for select
to anon
using (approved = true);

-- ผู้เข้าชมทั่วไปส่งกระทงได้ โดยข้อมูลต้องผ่านเงื่อนไขข้างต้น
create policy "Anyone can submit a krathong"
on public.krathongs for insert
to anon
with check (
  approved = true
  and char_length(message) between 1 and 180
  and char_length(name) <= 24
  and color in ('gold', 'pink', 'violet', 'green')
);

-- เปิด Realtime สำหรับตารางนี้
alter publication supabase_realtime add table public.krathongs;
