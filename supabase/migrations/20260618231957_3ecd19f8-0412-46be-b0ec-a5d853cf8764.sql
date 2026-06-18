CREATE POLICY "Match creators can insert approvals for their match"
ON public.match_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_approvals.match_id
      AND m.created_by = auth.uid()
  )
);