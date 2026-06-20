
CREATE OR REPLACE FUNCTION public.sync_match_verified_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_ids text[];
BEGIN
  v_match_id := COALESCE(NEW.match_id, OLD.match_id);
  SELECT COALESCE(array_agg(player_id::text ORDER BY approved_at), ARRAY[]::text[])
    INTO v_ids
    FROM public.match_approvals
   WHERE match_id = v_match_id AND approved = true;
  UPDATE public.matches SET verified_by = v_ids WHERE id = v_match_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_match_verified_by ON public.match_approvals;
CREATE TRIGGER trg_sync_match_verified_by
AFTER INSERT OR UPDATE OR DELETE ON public.match_approvals
FOR EACH ROW EXECUTE FUNCTION public.sync_match_verified_by();

UPDATE public.matches m
   SET verified_by = COALESCE(sub.ids, ARRAY[]::text[])
  FROM (
    SELECT match_id, array_agg(player_id::text ORDER BY approved_at) AS ids
      FROM public.match_approvals
     WHERE approved = true
     GROUP BY match_id
  ) sub
 WHERE sub.match_id = m.id;

UPDATE public.matches m
   SET verified_by = ARRAY[]::text[]
 WHERE NOT EXISTS (
   SELECT 1 FROM public.match_approvals ma
    WHERE ma.match_id = m.id AND ma.approved = true
 ) AND COALESCE(array_length(verified_by, 1), 0) > 0;
