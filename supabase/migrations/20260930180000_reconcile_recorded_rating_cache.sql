BEGIN;
-- Repair only cached profile ratings backed by an approved playing record.
-- Match results, rating snapshots and player-selected starting values are preserved.
-- Short bounded locks keep a simultaneous score approval from racing this repair.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
LOCK TABLE public.matches, public.match_participants, public.profiles IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.rating_cache_repair_audit (
 repair_key text NOT NULL,
 player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 previous_rating numeric,
 corrected_rating numeric NOT NULL,
 source_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
 repaired_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(repair_key,player_id)
);
ALTER TABLE public.rating_cache_repair_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rating_cache_repair_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.rating_cache_repair_audit TO service_role;

WITH candidates AS MATERIALIZED (
 SELECT p.id,p.current_rating AS previous_rating,
 coalesce(r.rating_after,p.initial_self_rating,3.00) AS corrected_rating,r.match_id
 FROM public.profiles p
 LEFT JOIN LATERAL (
  SELECT mp.rating_after,m.id AS match_id FROM public.match_participants mp
  JOIN public.matches m ON m.id=mp.match_id
  WHERE mp.player_id=p.id AND m.status='approved' AND NOT coalesce(m.voided,false)
   AND coalesce(m.count_for_rating,true) AND mp.rating_after IS NOT NULL
  ORDER BY m.match_date DESC,m.created_at DESC,m.id DESC LIMIT 1
 ) r ON true
 WHERE p.current_rating IS DISTINCT FROM coalesce(r.rating_after,p.initial_self_rating,3.00)
 AND EXISTS(SELECT 1 FROM public.match_participants mp JOIN public.matches m ON m.id=mp.match_id
  WHERE mp.player_id=p.id AND m.status='approved' AND NOT coalesce(m.voided,false))
), repaired AS (
 UPDATE public.profiles p SET current_rating=c.corrected_rating,updated_at=now()
 FROM candidates c WHERE p.id=c.id
 RETURNING c.id,c.previous_rating,c.corrected_rating,c.match_id
)
INSERT INTO public.rating_cache_repair_audit(repair_key,player_id,previous_rating,corrected_rating,source_match_id)
 SELECT '20260930_recorded_rating_cache',id,previous_rating,corrected_rating,match_id FROM repaired
 ON CONFLICT(repair_key,player_id) DO NOTHING;
COMMIT;
