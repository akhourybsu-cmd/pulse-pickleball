-- =====================================================================
-- Notify admins on match_issues insert (Phase 2.C.3).
--
-- MatchHistory.tsx tells the reporter "Issue reported. Admins have
-- been notified." but no trigger writes to user_notifications when a
-- match_issues row is inserted — admins never see the report unless
-- they manually query the table.
--
-- This trigger fans the new issue out to every user with the 'admin'
-- role in user_roles. Uses create_notification so the existing
-- per-category preference (`system`) and the push dispatch trigger
-- both apply automatically.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_admins_of_match_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin       RECORD;
  v_reporter    TEXT;
  v_issue_label TEXT;
BEGIN
  -- Pretty-print the issue type for the toast / drawer.
  v_issue_label := CASE NEW.issue_type
    WHEN 'contest_result'  THEN 'Score contested'
    WHEN 'wrong_court'     THEN 'Wrong court'
    WHEN 'wrong_opponent'  THEN 'Wrong opponent'
    WHEN 'didnt_play'      THEN 'Did not play'
    ELSE 'Match issue'
  END;

  SELECT display_name INTO v_reporter
    FROM public.profiles
   WHERE id = NEW.reported_by;

  FOR v_admin IN
    SELECT user_id
      FROM public.user_roles
     WHERE role = 'admin'::app_role
  LOOP
    PERFORM create_notification(
      v_admin.user_id,
      'match_issue_reported',
      'system',
      v_issue_label,
      COALESCE(v_reporter, 'A player') || ' reported a match',
      '/admin/matches?issue=' || NEW.id,
      'high',
      jsonb_build_object(
        'match_id',   NEW.match_id,
        'issue_id',   NEW.id,
        'issue_type', NEW.issue_type
      ),
      NEW.reported_by,
      now() + interval '30 days'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_issue_notify_admins ON public.match_issues;
CREATE TRIGGER on_match_issue_notify_admins
AFTER INSERT ON public.match_issues
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_of_match_issue();

COMMENT ON TRIGGER on_match_issue_notify_admins ON public.match_issues IS
  'Phase 2.C.3 — fans a new match issue out to every admin. The '
  'MatchHistory UI promises admins are notified; this trigger makes '
  'that promise true.';
