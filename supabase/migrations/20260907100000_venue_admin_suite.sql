-- =====================================================================
-- Venue admin suite: safe manager access and transactional staff controls.
--
-- Venue managers are allowed to manage courts and the daily operation, but
-- the original venues UPDATE policy still limited profile/hours changes to
-- venues.owner_id. The client consequently advertised settings that managers
-- could open but could not save.
--
-- Staff rows were writable directly as well. That made it possible for a
-- manager to attempt owner/manager role changes with no single authoritative
-- guard. This migration gives the admin UI one transactional entry point with
-- an explicit hierarchy:
--   owner   -> may manage managers, organizers and staff
--   manager -> may manage organizers and staff
--   nobody  -> may change or remove the venue owner here
--
-- Ownership continues to move only through transfer_group_ownership.
-- =====================================================================

BEGIN;

-- Managers may update ordinary venue fields. A trigger below makes owner_id a
-- protected field, so widening this policy does not widen ownership transfer.
DROP POLICY IF EXISTS "Owners can update their venues" ON public.venues;
DROP POLICY IF EXISTS "Venue owners and managers can update venues" ON public.venues;
CREATE POLICY "Venue owners and managers can update venues"
  ON public.venues FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.has_venue_role(auth.uid(), id, 'owner'::public.venue_role)
    OR public.has_venue_role(auth.uid(), id, 'manager'::public.venue_role)
  )
  WITH CHECK (
    public.has_venue_role(auth.uid(), id, 'owner'::public.venue_role)
    OR public.has_venue_role(auth.uid(), id, 'manager'::public.venue_role)
  );

CREATE OR REPLACE FUNCTION public.protect_venue_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND auth.uid() IS DISTINCT FROM OLD.owner_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Venue ownership must be transferred by the current owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_venue_owner_id_trigger ON public.venues;
CREATE TRIGGER protect_venue_owner_id_trigger
  BEFORE UPDATE OF owner_id ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_venue_owner_id();

-- One audited path for adding, changing, or removing venue staff. The target
-- must already be an active member of this venue's official community; this
-- prevents granting operational access to an arbitrary UUID.
CREATE OR REPLACE FUNCTION public.manage_venue_staff(
  p_venue_id uuid,
  p_user_id uuid,
  p_action text,
  p_role public.venue_role DEFAULT 'staff'::public.venue_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role public.venue_role;
  v_target_role public.venue_role;
  v_action text := lower(btrim(coalesce(p_action, '')));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT vs.role
    INTO v_caller_role
  FROM public.venue_staff vs
  WHERE vs.venue_id = p_venue_id
    AND vs.user_id = v_caller
    AND vs.is_active IS NOT FALSE
    AND (vs.status IS NULL OR vs.status = 'active')
  ORDER BY CASE vs.role
    WHEN 'owner' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'organizer' THEN 2
    ELSE 1
  END DESC
  LIMIT 1;

  IF v_caller_role IS NULL AND EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = p_venue_id AND v.owner_id = v_caller
  ) THEN
    v_caller_role := 'owner'::public.venue_role;
  END IF;

  IF v_caller_role NOT IN ('owner'::public.venue_role, 'manager'::public.venue_role) THEN
    RAISE EXCEPTION 'Only venue owners and managers can manage staff';
  END IF;

  SELECT vs.role
    INTO v_target_role
  FROM public.venue_staff vs
  WHERE vs.venue_id = p_venue_id
    AND vs.user_id = p_user_id
    AND vs.is_active IS NOT FALSE
  LIMIT 1;

  IF v_target_role = 'owner'::public.venue_role OR EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = p_venue_id AND v.owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'The venue owner can only change through ownership transfer';
  END IF;

  IF v_caller_role = 'manager'::public.venue_role
     AND (v_target_role = 'manager'::public.venue_role OR p_role = 'manager'::public.venue_role)
  THEN
    RAISE EXCEPTION 'Only the venue owner can manage manager access';
  END IF;

  IF v_action IN ('add', 'update', 'upsert') THEN
    IF p_role = 'owner'::public.venue_role THEN
      RAISE EXCEPTION 'Use ownership transfer to assign the owner role';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.groups g
      JOIN public.group_members gm ON gm.group_id = g.id
      WHERE g.venue_id = p_venue_id
        AND g.type = 'venue_official'
        AND gm.user_id = p_user_id
        AND gm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Staff must first be an active member of the venue community';
    END IF;

    INSERT INTO public.venue_staff (
      venue_id, user_id, role, invited_by, invited_at, accepted_at, is_active, status
    ) VALUES (
      p_venue_id, p_user_id, p_role, v_caller, now(), now(), true, 'active'
    )
    ON CONFLICT (venue_id, user_id) DO UPDATE
      SET role = EXCLUDED.role,
          invited_by = v_caller,
          accepted_at = COALESCE(public.venue_staff.accepted_at, now()),
          is_active = true,
          status = 'active';

  ELSIF v_action IN ('remove', 'delete', 'revoke') THEN
    DELETE FROM public.venue_staff
    WHERE venue_id = p_venue_id
      AND user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Unknown staff action: %', p_action;
  END IF;

  RETURN jsonb_build_object(
    'venue_id', p_venue_id,
    'user_id', p_user_id,
    'action', v_action,
    'role', CASE WHEN v_action IN ('remove', 'delete', 'revoke') THEN NULL ELSE p_role::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.manage_venue_staff(uuid, uuid, text, public.venue_role)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_venue_staff(uuid, uuid, text, public.venue_role)
  TO authenticated;

COMMENT ON FUNCTION public.manage_venue_staff(uuid, uuid, text, public.venue_role) IS
  'Transactional venue staff grant/revoke with owner > manager > organizer/staff hierarchy. '
  'Targets must be active members of the venue community; ownership moves only through '
  'transfer_group_ownership.';

COMMIT;
