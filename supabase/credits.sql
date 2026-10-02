-- neatx-ray credits. Run once in Supabase Dashboard > SQL Editor, AFTER schema.sql.
-- 1 credit = 1 scan. Doctors can read their own balance and history, but can never
-- add credits themselves: only spend_credits() is callable from the app, and
-- grant_credits() is restricted to the service role / SQL editor.

create table if not exists public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);

-- A reference (case id, payment id) can only be applied once per person.
create unique index if not exists credit_ledger_ref_idx on public.credit_ledger (user_id, ref) where ref is not null;
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "credit_balances_select_own" on public.credit_balances;
drop policy if exists "credit_ledger_select_own" on public.credit_ledger;
create policy "credit_balances_select_own" on public.credit_balances for select using (auth.uid() = user_id);
create policy "credit_ledger_select_own" on public.credit_ledger for select using (auth.uid() = user_id);
-- No insert/update/delete policies on purpose: the app cannot write these tables directly.

-- Spend credits for the signed-in doctor. Atomic; repeating the same ref never charges twice.
create or replace function public.spend_credits(p_amount integer, p_reason text, p_ref text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;

  if p_ref is not null and exists (select 1 from credit_ledger where user_id = v_user and ref = p_ref) then
    select balance into v_balance from credit_balances where user_id = v_user;
    return coalesce(v_balance, 0);
  end if;

  update credit_balances
     set balance = balance - p_amount, updated_at = now()
   where user_id = v_user and balance >= p_amount
   returning balance into v_balance;
  if not found then raise exception 'insufficient_credits'; end if;

  insert into credit_ledger (user_id, delta, reason, ref) values (v_user, -p_amount, p_reason, p_ref);
  return v_balance;
end;
$$;

-- Add credits to anyone. Never callable from the browser. Repeating the same ref adds nothing,
-- so a payment provider that retries its webhook cannot credit twice.
create or replace function public.grant_credits(p_user uuid, p_amount integer, p_reason text, p_ref text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;

  if p_ref is not null and exists (select 1 from credit_ledger where user_id = p_user and ref = p_ref) then
    select balance into v_balance from credit_balances where user_id = p_user;
    return coalesce(v_balance, 0);
  end if;

  insert into credit_balances (user_id, balance) values (p_user, p_amount)
  on conflict (user_id) do update set balance = credit_balances.balance + p_amount, updated_at = now()
  returning balance into v_balance;

  insert into credit_ledger (user_id, delta, reason, ref) values (p_user, p_amount, p_reason, p_ref);
  return v_balance;
end;
$$;

-- Convenience for adding credits by hand from the SQL editor:
--   select grant_credits_by_email('doctor@example.com', 50, 'manual top-up');
create or replace function public.grant_credits_by_email(p_email text, p_amount integer, p_reason text default 'manual top-up')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'no user with that email'; end if;
  return public.grant_credits(v_user, p_amount, p_reason, null);
end;
$$;

revoke all on function public.spend_credits(integer, text, text) from public, anon;
grant execute on function public.spend_credits(integer, text, text) to authenticated;

revoke all on function public.grant_credits(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, text) to service_role;

revoke all on function public.grant_credits_by_email(text, integer, text) from public, anon, authenticated;
grant execute on function public.grant_credits_by_email(text, integer, text) to service_role;
