-- Phase C upgrade (live view). Run ONCE in Supabase -> SQL Editor -> New query -> Run. Safe to run again.
-- Adds one read-only function. Nothing is changed or deleted. Run migration-b.sql first.
-- It returns no visitor IDs, only counts and the last 25 actions (page, action, source, device, time).
create or replace function public.fp_live(pass text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  perform public.fp_dashboard(pass, 1);   -- raises 'wrong passcode' if the passcode is wrong
  select jsonb_build_object(
    'active', (select count(distinct visitor_id)::int from public.fp_events where created_at >= now() - interval '5 minutes'),
    'pages', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select page, count(distinct visitor_id)::int as v from public.fp_events
        where created_at >= now() - interval '5 minutes' group by 1 order by 2 desc limit 8) t),
    'recent', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select created_at as at, page, event, coalesce(label,'') as label, coalesce(source,'direct') as source, coalesce(device,'') as device
        from public.fp_events where created_at >= now() - interval '60 minutes'
          and event in ('pageview','checkout_click','purchase','lead','scroll_90','js_error')
        order by created_at desc limit 25) t)
  ) into result;
  return result;
end $$;
revoke all on function public.fp_live(text) from public;
grant execute on function public.fp_live(text) to anon, authenticated;
