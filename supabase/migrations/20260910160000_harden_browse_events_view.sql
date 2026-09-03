-- Ensure the browse-events API cannot bypass row-level security on
-- unified_events or any of its joined tables. The original view inherited
-- PostgreSQL's owner-privileged behavior because it did not explicitly opt
-- into SECURITY INVOKER.

ALTER VIEW public.v_browse_events
  SET (security_invoker = true);

COMMENT ON VIEW public.v_browse_events IS
  'Event discovery projection. Executes as the caller so all underlying RLS policies remain in force.';
