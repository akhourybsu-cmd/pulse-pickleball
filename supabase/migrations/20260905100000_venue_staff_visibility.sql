-- =====================================================================
-- Let a venue's community see who works there.
--
-- venue_staff is currently readable only by the staff member themselves and by
-- owners/managers. That is right for the administrative columns, but it means
-- an ordinary member cannot tell staff apart from anyone else — so a post from
-- the front desk looks exactly like a post from a stranger, and "the courts are
-- closed tomorrow" carries no more weight than a rumour.
--
-- Two pieces, following the venue_coaches_public precedent already in this
-- schema:
--   1. a row-level policy letting members of the venue's community read its
--      staff rows,
--   2. a view exposing ONLY the three columns needed to render a badge, so
--      who invited whom and when stays between managers.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "Community members can see venue staff" ON public.venue_staff;
CREATE POLICY "Community members can see venue staff"
  ON public.venue_staff FOR SELECT TO authenticated
  USING (
    is_active IS NOT FALSE
    AND EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.venue_id = venue_staff.venue_id
        AND (
          g.visibility = 'public'
          OR EXISTS (
            SELECT 1 FROM public.group_members m
            WHERE m.group_id = g.id
              AND m.user_id = auth.uid()
              AND m.status = 'active'
          )
        )
    )
  );

-- Identity and role only. Everything else about a staff record — who invited
-- them, when they accepted — is nobody else's business.
CREATE OR REPLACE VIEW public.venue_staff_public
WITH (security_invoker = on) AS
SELECT venue_id, user_id, role
FROM public.venue_staff
WHERE is_active IS NOT FALSE
  AND (status IS NULL OR status = 'active');

GRANT SELECT ON public.venue_staff_public TO authenticated;

COMMENT ON VIEW public.venue_staff_public IS
  'Who works at a venue, for badging posts and messages. Identity and role '
  'only. security_invoker, so the caller still has to satisfy venue_staff RLS.';

COMMIT;
