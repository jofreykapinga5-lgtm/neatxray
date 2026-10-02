-- neatx-ray rate limiting. Run once in Supabase SQL Editor.
-- A shared counter in the database, so the limits hold across all of Vercel's servers.
-- Fixed windows: "at most N requests per key every W seconds".

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

-- Nobody can read or write this table directly; only the functions below can.
alter table public.rate_limits enable row level security;

-- Core counter. Internal: not callable from the browser.
create or replace function public._bump_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  if p_key is null or length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'bad_rate_limit_args';
  end if;

  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start + make_interval(secs => p_window_seconds) <= now() then 1 else r.count + 1 end,
    window_start = case when r.window_start + make_interval(secs => p_window_seconds) <= now() then now() else r.window_start end
  returning r.count, r.window_start into v_count, v_start;

  -- Now and then, tidy away old counters.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  retry_after := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - now())))::integer)
  end;
  return next;
end;
$$;

-- For signed-in doctors. The limits are fixed HERE, so a doctor calling this from their own browser
-- cannot loosen their own limit or reset their own counter. Change the numbers below to tune.
create or replace function public.rate_limit_user(p_bucket text)
returns table(allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_window integer;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;

  if p_bucket = 'analyze' then v_limit := 4;  v_window := 60;     -- 4 scans per minute
  elsif p_bucket = 'checkout' then v_limit := 5;  v_window := 3600;   -- 5 payment attempts per hour
  elsif p_bucket = 'status' then v_limit := 40; v_window := 60;     -- payment status checks
  elsif p_bucket = 'credits' then v_limit := 60; v_window := 60;     -- balance lookups
  else raise exception 'unknown_bucket';
  end if;

  return query select * from public._bump_rate_limit('u:' || auth.uid()::text || ':' || p_bucket, v_limit, v_window);
end;
$$;

-- For the server only (sign-in attempts, per-IP and global limits). Never callable from the browser,
-- otherwise anyone could use it to lock somebody else out.
create or replace function public.rate_limit_key(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, retry_after integer)
language sql
security definer
set search_path = public
as $$
  select * from public._bump_rate_limit(p_key, p_limit, p_window_seconds);
$$;

revoke all on function public._bump_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_user(text) from public, anon;
revoke all on function public.rate_limit_key(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_user(text) to authenticated;
grant execute on function public.rate_limit_key(text, integer, integer) to service_role;
