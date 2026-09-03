-- Reconcile ELEVENO authority after its legacy community-only ownership transfer.
--
-- Before transfer_group_ownership() became atomic, an official venue
-- community could promote its new owner without updating venues.owner_id or
-- venue_staff. The active group_members.owner row is the only explicit result
-- of that user-selected transfer, so use it as the authoritative owner and
-- bring venue access into lockstep.

BEGIN;

DO $$
DECLARE
  eleveno_community_count integer;
  eleveno_owner_count integer;
BEGIN
  SELECT count(*)
    INTO eleveno_community_count
  FROM public.groups AS community
  JOIN public.venues AS venue ON venue.id = community.venue_id
  WHERE community.type = 'venue_official'
    AND venue.slug = 'eleveno';

  SELECT count(*)
    INTO eleveno_owner_count
  FROM public.groups AS community
  JOIN public.venues AS venue ON venue.id = community.venue_id
  JOIN public.group_members AS member
    ON member.group_id = community.id
    AND member.role = 'owner'
    AND member.status = 'active'
  WHERE community.type = 'venue_official'
    AND venue.slug = 'eleveno';

  IF eleveno_community_count <> 1 OR eleveno_owner_count <> 1 THEN
    RAISE EXCEPTION
      'Cannot reconcile ELEVENO ownership: expected one official community and one active owner, found % and %',
      eleveno_community_count,
      eleveno_owner_count;
  END IF;
END;
$$;

CREATE TEMP TABLE venue_owner_reconciliation
ON COMMIT DROP
AS
SELECT
  venue.id AS venue_id,
  venue.owner_id AS previous_owner_id,
  member.user_id AS authoritative_owner_id
FROM public.venues AS venue
JOIN public.groups AS community
  ON community.venue_id = venue.id
  AND community.type = 'venue_official'
JOIN public.group_members AS member
  ON member.group_id = community.id
  AND member.role = 'owner'
  AND member.status = 'active'
WHERE venue.slug = 'eleveno';

-- Preserve the previous venue owner's promised operational access.
INSERT INTO public.venue_staff (
  venue_id,
  user_id,
  role,
  invited_by,
  invited_at,
  accepted_at,
  is_active,
  status
)
SELECT
  reconciliation.venue_id,
  reconciliation.previous_owner_id,
  'manager',
  reconciliation.authoritative_owner_id,
  now(),
  now(),
  true,
  'active'
FROM venue_owner_reconciliation AS reconciliation
WHERE reconciliation.previous_owner_id IS NOT NULL
  AND reconciliation.previous_owner_id <> reconciliation.authoritative_owner_id
ON CONFLICT (venue_id, user_id) DO UPDATE
SET role = 'manager',
    accepted_at = COALESCE(public.venue_staff.accepted_at, now()),
    is_active = true,
    status = 'active',
    updated_at = now();

-- There must be one staff owner, matching the community owner.
UPDATE public.venue_staff AS staff
SET role = 'manager',
    updated_at = now()
FROM venue_owner_reconciliation AS reconciliation
WHERE staff.venue_id = reconciliation.venue_id
  AND staff.role = 'owner'
  AND staff.user_id <> reconciliation.authoritative_owner_id;

INSERT INTO public.venue_staff (
  venue_id,
  user_id,
  role,
  invited_by,
  invited_at,
  accepted_at,
  is_active,
  status
)
SELECT
  reconciliation.venue_id,
  reconciliation.authoritative_owner_id,
  'owner',
  reconciliation.authoritative_owner_id,
  now(),
  now(),
  true,
  'active'
FROM venue_owner_reconciliation AS reconciliation
ON CONFLICT (venue_id, user_id) DO UPDATE
SET role = 'owner',
    accepted_at = COALESCE(public.venue_staff.accepted_at, now()),
    is_active = true,
    status = 'active',
    updated_at = now();

-- This is a one-time, transaction-scoped repair of a transfer that predates
-- the protection trigger. Disabling this one trigger takes an ACCESS
-- EXCLUSIVE table lock, so no concurrent update can slip through. Any failure
-- rolls the trigger state back with the rest of the transaction.
ALTER TABLE public.venues
  DISABLE TRIGGER protect_venue_owner_id_trigger;

UPDATE public.venues AS venue
SET owner_id = reconciliation.authoritative_owner_id,
    updated_at = now()
FROM venue_owner_reconciliation AS reconciliation
WHERE venue.id = reconciliation.venue_id
  AND venue.owner_id IS DISTINCT FROM reconciliation.authoritative_owner_id;

ALTER TABLE public.venues
  ENABLE TRIGGER protect_venue_owner_id_trigger;

COMMIT;
