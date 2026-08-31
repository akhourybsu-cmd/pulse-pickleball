-- =====================================================================
-- Tournaments: close anonymous read/write exposure while the feature is dark
--
-- The client feature flag (VITE_TOURNAMENTS) hides the UI, but RLS was still
-- serving the tournament surface to `anon`. Several policies were created
-- without a `TO` clause, which defaults to role PUBLIC and therefore includes
-- unauthenticated clients:
--
--   tournaments_events            3 overlapping public SELECT policies, one of
--                                 them explicitly TO anon. `visibility` and
--                                 `is_public` both DEFAULT to public, so this
--                                 let anyone enumerate tournament names, dates,
--                                 venue_id, fees and slugs.
--   tournaments_divisions/teams/  public SELECT keyed on the parent event's
--   matches/courts                public_view_enabled. tournaments_teams also
--                                 exposes player1_id/player2_id profile UUIDs.
--   tournament_event_settings     "viewable by everyone" USING (true) — every
--                                 row, unconditionally, to anon.
--   tournament_customization       published rows readable by anon (already
--                                 PII-hardened, but still public).
--   tournament_registration_       INSERT ... WITH CHECK (true) with no TO —
--   notifications                  an unauthenticated write path.
--
-- This migration removes anonymous access entirely. Organizer/admin access via
-- authenticated policies is untouched, so the feature can still be built and
-- tested. Public read is deliberately NOT replaced with a narrower public
-- policy — when tournaments launch, public visibility should be re-granted
-- explicitly and reviewed at that time.
--
-- Reversible: re-create the dropped policies to restore the old behavior.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. tournaments_events — drop all three anon-readable SELECT policies
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view tournaments"       ON public.tournaments_events;
DROP POLICY IF EXISTS "Public can view enabled events"    ON public.tournaments_events;
DROP POLICY IF EXISTS "Users can view public tournaments" ON public.tournaments_events;

-- ---------------------------------------------------------------------
-- 2. Child tables — drop the public_view_enabled passthrough policies
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view divisions of enabled events" ON public.tournaments_divisions;
DROP POLICY IF EXISTS "Public can view teams of enabled events"     ON public.tournaments_teams;
DROP POLICY IF EXISTS "Public can view matches of enabled events"   ON public.tournaments_matches;
DROP POLICY IF EXISTS "Public can view courts of enabled events"    ON public.tournaments_courts;

-- ---------------------------------------------------------------------
-- 3. tournament_event_settings — replace USING (true) with owner/admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Event settings are viewable by everyone" ON public.tournament_event_settings;

CREATE POLICY "Event settings viewable by organizer or admin"
ON public.tournament_event_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments_events te
    WHERE te.id = tournament_event_settings.event_id
      AND (te.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- ---------------------------------------------------------------------
-- 4. tournament_customization — no anon read while dark
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view published customizations (no PII)"
  ON public.tournament_customization;

-- ---------------------------------------------------------------------
-- 5. Close the unauthenticated INSERT on registration notifications.
--    Edge functions use the service role, which bypasses RLS, so they are
--    unaffected by removing this policy.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert notifications"
  ON public.tournament_registration_notifications;

-- ---------------------------------------------------------------------
-- 6. Belt and braces: even with no policy granting it, drop the table-level
--    grants so `anon` cannot read the tournament surface at all.
-- ---------------------------------------------------------------------
REVOKE ALL ON public.tournaments_events                    FROM anon;
REVOKE ALL ON public.tournaments_divisions                 FROM anon;
REVOKE ALL ON public.tournaments_teams                     FROM anon;
REVOKE ALL ON public.tournaments_matches                   FROM anon;
REVOKE ALL ON public.tournaments_courts                    FROM anon;
REVOKE ALL ON public.tournaments_scoring_rulesets          FROM anon;
REVOKE ALL ON public.tournament_event_settings             FROM anon;
REVOKE ALL ON public.tournament_customization              FROM anon;
REVOKE ALL ON public.tournament_registrations              FROM anon;
REVOKE ALL ON public.tournament_registration_notifications FROM anon;
REVOKE ALL ON public.tournament_email_templates            FROM anon;

COMMIT;
