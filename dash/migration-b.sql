-- Phase B upgrade. Run ONCE in Supabase -> SQL Editor -> New query -> Run. Safe to run again.
-- It only ADDS things. Nothing is deleted or replaced, and your passcode is not touched.
-- The website and dashboard keep working before and after you run it.

-- 1. Campaign columns on the events table (old rows keep working; they simply have no campaign).
alter table public.fp_events add column if not exists medium   text check (char_length(medium)   <= 60);
alter table public.fp_events add column if not exists campaign text check (char_length(campaign) <= 60);
alter table public.fp_events add column if not exists content  text check (char_length(content)  <= 60);
alter table public.fp_events add column if not exists term     text check (char_length(term)     <= 60);
create index if not exists fp_events_campaign_idx on public.fp_events (campaign);

-- 2. A second dashboard function. It checks the passcode by calling your existing fp_dashboard,
--    so the passcode stays in one place and is not repeated here.
create or replace function public.fp_dashboard_v2(pass text, days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := greatest(1, least(days, 365));
  since timestamptz := now() - make_interval(days => n);
  result jsonb;
begin
  perform public.fp_dashboard(pass, 1);   -- raises 'wrong passcode' if the passcode is wrong
  select jsonb_build_object(
    'campaigns', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select coalesce(source,'direct') as source, coalesce(medium,'') as medium, coalesce(campaign,'') as campaign,
             coalesce(content,'') as content, coalesce(term,'') as term,
             count(distinct visitor_id) filter (where event = 'pageview')::int as v,
             count(distinct visitor_id) filter (where event = 'checkout_click')::int as c,
             count(*) filter (where event = 'purchase')::int as p,
             coalesce(sum(value) filter (where event = 'purchase'), 0)::numeric as rev
      from public.fp_events
      where created_at >= since and (campaign is not null or medium is not null or content is not null or term is not null)
      group by 1,2,3,4,5) t),
    'hours', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select extract(hour from created_at at time zone 'Africa/Lagos')::int as h,
             count(distinct visitor_id)::int as v
      from public.fp_events
      where created_at >= since and event = 'pageview'
      group by 1 order by 1) t),
    'audience', (select jsonb_build_object('new', count(*) filter (where first_seen >= since),
                                           'returning', count(*) filter (where first_seen < since))
      from (select visitor_id, min(created_at) as first_seen from public.fp_events group by 1) f
      where visitor_id in (select distinct visitor_id from public.fp_events where created_at >= since and event = 'pageview'))
  ) into result;
  return result;
end $$;
revoke all on function public.fp_dashboard_v2(text,int) from public;
grant execute on function public.fp_dashboard_v2(text,int) to anon, authenticated;
