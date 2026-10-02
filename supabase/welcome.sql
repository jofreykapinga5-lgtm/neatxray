-- neatx-ray welcome credits. Run once in Supabase SQL Editor, AFTER credits.sql.
-- Every new account gets 5 free credits once its email is confirmed (Google sign-ups count as confirmed).
-- Change the 5 below to give a different number to future accounts.

create or replace function public.give_welcome_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null then
    -- The reference makes this once per person, even if the trigger fires twice.
    perform public.grant_credits(new.id, 5, 'welcome', 'welcome');
  end if;
  return new;
exception when others then
  -- Never block someone from creating an account because of a credits problem.
  raise warning 'welcome credits failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists welcome_credits_on_signup on auth.users;
create trigger welcome_credits_on_signup
  after insert on auth.users
  for each row execute function public.give_welcome_credits();

drop trigger if exists welcome_credits_on_confirm on auth.users;
create trigger welcome_credits_on_confirm
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.give_welcome_credits();

-- Optional: give the same 5 credits to accounts that already exist (once each):
--   select grant_credits(id, 5, 'welcome', 'welcome') from auth.users where email_confirmed_at is not null;
