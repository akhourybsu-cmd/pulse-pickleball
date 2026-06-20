DROP POLICY IF EXISTS "Players can view their match approvals" ON public.match_approvals;

CREATE POLICY "Match participants can view all approvals for their matches"
  ON public.match_approvals FOR SELECT TO authenticated
  USING (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM public.match_participants mp
       WHERE mp.match_id = match_approvals.match_id
         AND mp.player_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.matches m
       WHERE m.id = match_approvals.match_id
         AND m.created_by = auth.uid()
    )
  );