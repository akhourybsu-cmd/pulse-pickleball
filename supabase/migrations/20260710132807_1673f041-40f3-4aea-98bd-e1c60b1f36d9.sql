-- =====================================================================
-- Claimed guests: surface their guest matches on the linked profile.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.apply_guest_link(_guest_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.guest_players
    SET linked_user_id = _user_id,
        linked_at = now(),
        display_name = COALESCE(public.resolved_profile_name(_user_id), display_name)
    WHERE id = _guest_id;

  UPDATE public.match_participants mp
    SET player_id = _user_id
    WHERE mp.guest_player_id = _guest_id
      AND mp.player_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.match_participants mp2
        WHERE mp2.match_id = mp.match_id
          AND mp2.player_id = _user_id
      );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_guest_link(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.claim_guest_profile(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.guest_claim_invites%ROWTYPE;
  v_guest public.guest_players%ROWTYPE;
  v_user_email text;
  v_auto_link boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM public.guest_claim_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_invite.status NOT IN ('pending','awaiting_approval') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_'|| v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.guest_claim_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT * INTO v_guest FROM public.guest_players WHERE id = v_invite.guest_player_id;
  IF v_guest.linked_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_linked');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  IF v_invite.invited_email IS NOT NULL
     AND lower(v_invite.invited_email) = lower(coalesce(v_user_email, '')) THEN
    v_auto_link := true;
  ELSIF v_invite.requires_approval = false THEN
    v_auto_link := true;
  END IF;

  IF v_auto_link THEN
    PERFORM public.apply_guest_link(v_guest.id, auth.uid());

    UPDATE public.guest_claim_invites
      SET status = 'accepted',
          accepted_at = now(),
          accepted_by_user_id = auth.uid()
      WHERE id = v_invite.id;

    RETURN jsonb_build_object('ok', true, 'status', 'linked');
  ELSE
    UPDATE public.guest_claim_invites
      SET status = 'awaiting_approval',
          accepted_by_user_id = auth.uid()
      WHERE id = v_invite.id;

    RETURN jsonb_build_object('ok', true, 'status', 'awaiting_approval');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_guest_profile(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_guest_claim(_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.guest_claim_invites%ROWTYPE;
  v_guest public.guest_players%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.guest_claim_invites WHERE id = _invite_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_invite');
  END IF;
  IF v_invite.created_by <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF v_invite.status <> 'awaiting_approval' OR v_invite.accepted_by_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  SELECT * INTO v_guest FROM public.guest_players WHERE id = v_invite.guest_player_id;
  IF v_guest.linked_user_id IS NULL THEN
    PERFORM public.apply_guest_link(v_invite.guest_player_id, v_invite.accepted_by_user_id);
  END IF;

  UPDATE public.guest_claim_invites
    SET status = 'accepted',
        accepted_at = now()
    WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_guest_claim(uuid) TO authenticated;

UPDATE public.match_participants mp
  SET player_id = gp.linked_user_id
  FROM public.guest_players gp
  WHERE mp.guest_player_id = gp.id
    AND gp.linked_user_id IS NOT NULL
    AND mp.player_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.match_participants mp2
      WHERE mp2.match_id = mp.match_id
        AND mp2.player_id = gp.linked_user_id
    );

-- =====================================================================
-- Fix suggest_friends + search_connectable_users
-- =====================================================================

CREATE OR REPLACE FUNCTION public.suggest_friends()
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text,
  reason text,
  weight int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT mp2.player_id AS uid, 'Played together'::text AS reason, 10 AS weight
    FROM public.match_participants mp1
    JOIN public.matches m
      ON m.id = mp1.match_id
     AND m.status = 'approved'
     AND COALESCE(m.voided, false) = false
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION ALL
    SELECT rp2.player_id AS uid, 'Played round robin'::text AS reason, 9 AS weight
    FROM public.round_robin_players rp1
    JOIN public.round_robin_players rp2
      ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me
      AND rp1.active = true
      AND rp2.active = true
    UNION ALL
    SELECT CASE WHEN f2.user_id IN (fr.user_id, fr.friend_id) THEN f2.friend_id ELSE f2.user_id END,
           'Mutual friend'::text, 8
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION ALL
    SELECT gm2.user_id, 'Shared group'::text, 5
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION ALL
    SELECT er2.user_id, 'Shared event'::text, 3
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
  ),
  excluded AS (
    SELECT CASE WHEN user_id = me THEN friend_id ELSE user_id END AS uid
    FROM public.friendships
    WHERE (user_id = me OR friend_id = me)
      AND status IN ('accepted', 'pending', 'blocked')
    UNION
    SELECT dismissed_user_id AS uid
    FROM public.friend_suggestion_dismissals
    WHERE user_id = me
    UNION
    SELECT CASE WHEN blocker_id = me THEN blocked_id ELSE blocker_id END AS uid
    FROM public.user_blocks
    WHERE blocker_id = me OR blocked_id = me
  ),
  aggregated AS (
    SELECT uid, sum(weight)::int AS total_weight, count(*)::int AS hits
    FROM candidates
    WHERE uid IS NOT NULL
      AND uid NOT IN (SELECT uid FROM excluded WHERE uid IS NOT NULL)
    GROUP BY uid
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
         (SELECT c.reason FROM candidates c WHERE c.uid = a.uid ORDER BY c.weight DESC LIMIT 1) AS reason,
         a.total_weight AS weight
  FROM aggregated a
  JOIN public.profiles p ON p.id = a.uid
  ORDER BY a.total_weight DESC, a.hits DESC
  LIMIT 24;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_friends() TO authenticated;

CREATE OR REPLACE FUNCTION public.search_connectable_users(_query text)
RETURNS TABLE (
  id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  current_rating numeric,
  handle text,
  reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); q text;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  q := trim(coalesce(_query, ''));
  IF length(q) < 2 THEN RETURN; END IF;

  RETURN QUERY
  WITH connected AS (
    SELECT DISTINCT CASE WHEN f2.user_id = fr.friend_id THEN f2.friend_id ELSE f2.user_id END AS uid,
           'Mutual friend'::text AS reason
    FROM public.friendships fr
    JOIN public.friendships f2
      ON f2.status = 'accepted'
     AND (f2.user_id IN (fr.user_id, fr.friend_id) OR f2.friend_id IN (fr.user_id, fr.friend_id))
    WHERE fr.status = 'accepted'
      AND (fr.user_id = me OR fr.friend_id = me)
    UNION
    SELECT DISTINCT gm2.user_id, 'Shared group'::text
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id <> me
    WHERE gm1.user_id = me
    UNION
    SELECT DISTINCT er2.user_id, 'Shared event'::text
    FROM public.calendar_event_registrations er1
    JOIN public.calendar_event_registrations er2 ON er2.event_id = er1.event_id AND er2.user_id <> me
    WHERE er1.user_id = me
    UNION
    SELECT DISTINCT mp2.player_id, 'Played together'::text
    FROM public.match_participants mp1
    JOIN public.matches m
      ON m.id = mp1.match_id
     AND m.status = 'approved'
     AND COALESCE(m.voided, false) = false
    JOIN public.match_participants mp2
      ON mp2.match_id = mp1.match_id AND mp2.player_id <> me
    WHERE mp1.player_id = me
    UNION
    SELECT DISTINCT rp2.player_id, 'Played round robin'::text
    FROM public.round_robin_players rp1
    JOIN public.round_robin_players rp2
      ON rp2.event_id = rp1.event_id AND rp2.player_id <> me
    WHERE rp1.player_id = me
  )
  SELECT p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle,
         min(c.reason) AS reason
  FROM connected c
  JOIN public.profiles p ON p.id = c.uid
  WHERE p.id <> me
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
       WHERE (ub.blocker_id = me AND ub.blocked_id = p.id)
          OR (ub.blocker_id = p.id AND ub.blocked_id = me)
    )
    AND (
      p.display_name ILIKE '%' || q || '%'
      OR p.full_name ILIKE '%' || q || '%'
      OR p.handle ILIKE '%' || regexp_replace(q, '^@', '') || '%'
    )
  GROUP BY p.id, p.display_name, p.full_name, p.avatar_url, p.current_rating, p.handle
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_connectable_users(text) TO authenticated;