-- Fineboy Producer analytics: run this ONCE in Supabase -> SQL Editor -> New query -> Run.
-- Before running, replace CHANGE-THIS-PASSCODE (one place, marked below) with a long passcode only you know.

create table if not exists public.fp_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  text not null check (char_length(visitor_id) <= 40),
  session_id  text not null check (char_length(session_id) <= 40),
  page        text not null check (char_length(page) <= 120),
  event       text not null check (char_length(event) <= 40),
  variant     text check (char_length(variant) <= 120),
  label       text check (char_length(label) <= 60),
  value       numeric,
  source      text check (char_length(source) <= 60),
  device      text check (char_length(device) <= 10)
);
create index if not exists fp_events_created_idx on public.fp_events (created_at);
create index if not exists fp_events_page_event_idx on public.fp_events (page, event);

-- The website can only ADD rows. Nobody can read the table directly.
alter table public.fp_events enable row level security;
drop policy if exists fp_events_insert on public.fp_events;
create policy fp_events_insert on public.fp_events for insert to anon, authenticated with check (true);
revoke all on public.fp_events from anon, authenticated;
grant insert on public.fp_events to anon, authenticated;

-- The dashboard reads totals through this function, which only answers when the passcode is right.
create or replace function public.fp_dashboard(pass text, days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  secret constant text := 'CHANGE-THIS-PASSCODE';   -- <<< put your own passcode here
  result jsonb;
begin
  if pass is distinct from secret then
    perform pg_sleep(1);
    raise exception 'wrong passcode' using errcode = '28000';
  end if;
  select jsonb_build_object(
    'totals', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select page, event, coalesce(variant,'') as variant, coalesce(label,'') as label,
             coalesce(source,'direct') as source, coalesce(device,'') as device,
             count(*)::int as n, count(distinct visitor_id)::int as u, coalesce(sum(value),0)::numeric as v
      from public.fp_events
      where created_at >= now() - make_interval(days => greatest(1, least(days, 365)))
      group by 1,2,3,4,5,6) t),
    'daily', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select (created_at at time zone 'Africa/Lagos')::date as d, page, event,
             count(*)::int as n, count(distinct visitor_id)::int as u
      from public.fp_events
      where created_at >= now() - make_interval(days => greatest(1, least(days, 365)))
      group by 1,2,3) t)
  ) into result;
  return result;
end $$;
revoke all on function public.fp_dashboard(text,int) from public;
grant execute on function public.fp_dashboard(text,int) to anon, authenticated;
