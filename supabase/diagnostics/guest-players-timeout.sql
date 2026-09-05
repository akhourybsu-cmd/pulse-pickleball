-- guest_players statement timeouts (authenticated role only)
-- Run in Supabase SQL Editor against rqfqwavhtfwwtmfjnxkx.
-- Symptom: ANY statement on public.guest_players as `authenticated` costs 6-9s
-- (independent of row count) and often dies with SQLSTATE 57014
-- "canceling statement due to statement timeout". Anonymous reads are instant.
-- Tables referenced by the policies are tiny (rrp=0, rre=10, schedule=85, group_members=35).

-- 1. Which policies exist on guest_players right now
select polname, polcmd,
       pg_get_expr(polqual, polrelid)  as using_expr,
       pg_get_expr(polwithcheck, polrelid) as check_expr
from pg_policy
where polrelid = 'public.guest_players'::regclass;

-- 2. Invalid indexes anywhere (breaks policy subquery plans)
select indexrelid::regclass as index_name, indrelid::regclass as table_name,
       indisvalid, indisready
from pg_index
where not indisvalid;

-- 3. Bloat / analyze state on the involved tables
select relname, n_live_tup, n_dead_tup, last_analyze, last_vacuum
from pg_stat_user_tables
where relname in ('guest_players','group_members','round_robin_players',
                  'round_robin_schedule','round_robin_events');

-- 4. Any transaction holding locks on guest_players
select pid, wait_event_type, wait_event, state, xact_start, left(query, 100) as query
from pg_stat_activity
where state <> 'idle'
order by xact_start nulls last;

-- 5. THE DECISIVE TEST: explain the exact statement the REST client runs,
--    as the authenticated role. The ANALYZE output shows which policy
--    subquery eats the seconds.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"116a40bf-0acd-4ce7-9dff-e0ff84103bfa","role":"authenticated"}', true);
explain (analyze, buffers)
select gp.*, pp.*
from public.guest_players gp
left join public.profiles_public pp on pp.id = gp.linked_user_id
limit 5;
rollback;
