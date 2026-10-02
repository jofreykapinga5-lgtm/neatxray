-- neatx-ray credit purchases. Run once in Supabase SQL Editor, AFTER credits.sql.
-- Rows are created and updated only by the server (service role); doctors can read their own.

create table if not exists public.credit_purchases (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  credits integer not null check (credits > 0),
  amount integer not null check (amount > 0),
  provider text not null,
  provider_ref text,
  status text not null default 'creating',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists credit_purchases_user_idx on public.credit_purchases (user_id, created_at desc);

alter table public.credit_purchases enable row level security;
drop policy if exists "credit_purchases_select_own" on public.credit_purchases;
create policy "credit_purchases_select_own" on public.credit_purchases for select using (auth.uid() = user_id);
