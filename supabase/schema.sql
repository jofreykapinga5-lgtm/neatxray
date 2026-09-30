-- neatx-ray schema. Run once in Supabase Dashboard > SQL Editor.

-- Cases: one row per analysis session
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  clinical_notes text not null default '',
  provider text not null default '',
  model text not null default '',
  report jsonb,
  created_at timestamptz not null default now()
);

-- Images attached to a case (files live in the private 'scans' bucket)
create table if not exists public.case_images (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_name text not null default '',
  mime_type text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists cases_user_created_idx on public.cases (user_id, created_at desc);
create index if not exists case_images_case_idx on public.case_images (case_id);

-- Row-level security: each doctor sees only their own rows
alter table public.cases enable row level security;
alter table public.case_images enable row level security;

drop policy if exists "cases_select_own" on public.cases;
drop policy if exists "cases_insert_own" on public.cases;
drop policy if exists "cases_update_own" on public.cases;
drop policy if exists "cases_delete_own" on public.cases;
create policy "cases_select_own" on public.cases for select using (auth.uid() = user_id);
create policy "cases_insert_own" on public.cases for insert with check (auth.uid() = user_id);
create policy "cases_update_own" on public.cases for update using (auth.uid() = user_id);
create policy "cases_delete_own" on public.cases for delete using (auth.uid() = user_id);

drop policy if exists "case_images_select_own" on public.case_images;
drop policy if exists "case_images_insert_own" on public.case_images;
drop policy if exists "case_images_delete_own" on public.case_images;
create policy "case_images_select_own" on public.case_images for select using (auth.uid() = user_id);
create policy "case_images_insert_own" on public.case_images for insert with check (auth.uid() = user_id);
create policy "case_images_delete_own" on public.case_images for delete using (auth.uid() = user_id);

-- Private storage bucket for scans (NOT public)
insert into storage.buckets (id, name, public, file_size_limit)
values ('scans', 'scans', false, 10485760)
on conflict (id) do update set public = false;

-- Files are stored under "<user_id>/<case_id>/<file>"; users can only touch their own folder
drop policy if exists "scans_select_own" on storage.objects;
drop policy if exists "scans_insert_own" on storage.objects;
drop policy if exists "scans_delete_own" on storage.objects;
create policy "scans_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'scans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "scans_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'scans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "scans_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'scans' and (storage.foldername(name))[1] = auth.uid()::text);

-- Structured patient context (no names, phone numbers or addresses)
alter table public.cases add column if not exists patient_age integer check (patient_age is null or (patient_age >= 0 and patient_age <= 120));
alter table public.cases add column if not exists patient_sex text not null default '';
alter table public.cases add column if not exists symptoms text not null default '';
alter table public.cases add column if not exists medical_history text not null default '';
alter table public.cases add column if not exists clinical_question text not null default '';
