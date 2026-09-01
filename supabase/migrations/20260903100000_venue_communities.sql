-- =====================================================================
-- Venue communities: let a venue create its own branded community.
--
-- Almost all of this already existed and was switched off. `groups` already
-- carries `venue_id`, `is_venue_verified` and a `venue_official` type;
-- useGroups already joins the venue's branding into every group; GroupDetail
-- still has the accent-colour plumbing, fed a hard-coded null. What was never
-- built is the path that creates the venue in the first place.
--
-- This adds:
--   1. an atomic constructor, because a venue community is three rows in three
--      tables and a half-created one leaves an orphan venue nobody can reach;
--   2. one official community per venue;
--   3. read access to a venue for the people who can see its community —
--      without this the branding join returns NULL for every member who isn't
--      staff, because venues are only visible to owners, staff, and venues
--      that an admin has already moved to `active`.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- One official community per venue.
--
-- Partial, so ordinary groups (which all have venue_id NULL) are unaffected
-- and a venue can still be *referenced* by other group types later.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_one_official_community_per_venue
  ON public.groups (venue_id)
  WHERE venue_id IS NOT NULL AND type = 'venue_official';

-- ---------------------------------------------------------------------
-- Let a community's audience read that community's venue.
--
-- The existing policy ("Active venues visible to all") only exposes venues
-- whose activation_state is 'active' — i.e. ones an admin has verified. A
-- freshly claimed venue is invisible to everyone but its owner and staff, so
-- its own members would see an unbranded community until verification.
-- Verification still gates the VERIFIED BADGE (groups.is_venue_verified); it
-- should not gate the venue's name and colours from its own members.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Venues behind a visible community are readable" ON public.venues;
CREATE POLICY "Venues behind a visible community are readable"
  ON public.venues FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.venue_id = venues.id
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

-- ---------------------------------------------------------------------
-- Atomic constructor.
--
-- SECURITY DEFINER so the three writes happen as one unit under one set of
-- rules, rather than as three client round-trips where a failure on the second
-- leaves an unreachable venue behind. The creator is always auth.uid(); the
-- function never takes an owner as a parameter, so it cannot be used to create
-- a venue on someone else's behalf.
--
-- Group membership is not inserted here: trigger_add_group_creator_as_owner
-- already makes the creator the group owner on INSERT.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_venue_community(
  p_name text,
  p_description text DEFAULT NULL,
  p_visibility public.group_visibility DEFAULT 'public',
  p_join_method public.group_join_method DEFAULT 'open',
  p_venue_type public.venue_type DEFAULT 'other',
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_name  text := nullif(btrim(p_name), '');
  v_base  text;
  v_slug  text;
  v_n     integer := 1;
  v_venue uuid;
  v_group uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Venue name is required';
  END IF;

  -- Slug from the name, uniquified. Venues are addressable by slug, so this
  -- has to be collision-free rather than best-effort.
  v_base := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  IF v_base = '' THEN
    v_base := 'venue';
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.venues WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  -- 'claimed', not 'active': a self-created venue is unverified until an admin
  -- says otherwise. That is what the verified badge reflects.
  INSERT INTO public.venues (
    name, slug, description, owner_id, venue_type, city, state,
    activation_state, is_active, is_published
  )
  VALUES (
    v_name, v_slug, nullif(btrim(coalesce(p_description, '')), ''), v_uid,
    p_venue_type, nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_state, '')), ''),
    'claimed', true, false
  )
  RETURNING id INTO v_venue;

  -- venue_staff carries both is_active and status; different call sites check
  -- different ones, so set both rather than leaning on the column default.
  INSERT INTO public.venue_staff (venue_id, user_id, role, accepted_at, is_active, status)
  VALUES (v_venue, v_uid, 'owner', now(), true, 'active')
  ON CONFLICT (venue_id, user_id) DO NOTHING;

  INSERT INTO public.groups (
    name, description, type, visibility, join_method, venue_id,
    is_venue_verified, created_by
  )
  VALUES (
    v_name, nullif(btrim(coalesce(p_description, '')), ''), 'venue_official',
    p_visibility, p_join_method, v_venue, false, v_uid
  )
  RETURNING id INTO v_group;

  RETURN jsonb_build_object(
    'venue_id', v_venue,
    'group_id', v_group,
    'slug', v_slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_venue_community(
  text, text, public.group_visibility, public.group_join_method,
  public.venue_type, text, text
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_venue_community(
  text, text, public.group_visibility, public.group_join_method,
  public.venue_type, text, text
) TO authenticated;

COMMENT ON FUNCTION public.create_venue_community(
  text, text, public.group_visibility, public.group_join_method,
  public.venue_type, text, text
) IS
  'Creates a venue, makes the caller its owner in venue_staff, and opens the '
  'venue''s official community, as one transaction. Returns venue_id, group_id '
  'and slug. The venue starts unverified (activation_state = claimed).';

COMMIT;
