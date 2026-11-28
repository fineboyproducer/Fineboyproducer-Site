-- Phase D upgrade (verified Paystack payments). Run ONCE in Supabase -> SQL Editor -> New query -> Run. Safe to run again.
-- Adds one table and one read-only function. Nothing is changed or deleted. Run migration-b.sql first.
-- The table holds NO names, emails or phone numbers: only a payment reference, amount, channel and time.
create table if not exists public.fp_payments (
  reference    text primary key,
  status       text not null default 'success',
  currency     text not null default 'NGN',
  amount_ngn   numeric not null default 0,
  refunded_ngn numeric not null default 0,
  channel      text,
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
alter table public.fp_payments enable row level security;   -- no public access; only the webhook (service role) and the function below touch it
create index if not exists fp_payments_paid_idx on public.fp_payments (paid_at);

create or replace function public.fp_payments_summary(pass text, days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare n int := greatest(1, least(days, 365)); since timestamptz := now() - make_interval(days => n);
begin
  perform public.fp_dashboard(pass, 1);   -- raises 'wrong passcode' if the passcode is wrong
  return jsonb_build_object(
    'sales',    (select count(*)::int from public.fp_payments where paid_at >= since and status = 'success'),
    'revenue',  (select coalesce(sum(amount_ngn), 0) from public.fp_payments where paid_at >= since and status = 'success'),
    'refunded', (select coalesce(sum(refunded_ngn), 0) from public.fp_payments where paid_at >= since),
    'all_time', (select count(*)::int from public.fp_payments),
    'recent',   (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                   select right(reference, 6) as ref, amount_ngn, refunded_ngn, coalesce(channel, '') as channel, paid_at
                   from public.fp_payments order by paid_at desc limit 10) t)
  );
end $$;
revoke all on function public.fp_payments_summary(text,int) from public;
grant execute on function public.fp_payments_summary(text,int) to anon, authenticated;
