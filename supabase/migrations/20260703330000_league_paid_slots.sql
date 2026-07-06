-- =====================================================================
-- Freemium: additional league slots via one-time purchase
--
-- Model:
--   * Every authenticated user gets 1 free league.
--   * Each additional league needs a purchased slot.
--   * profiles.additional_league_slots tracks how many extra slots
--     the user has bought. Fulfilled by a Stripe checkout flow.
--
-- Total leagues allowed = 1 + additional_league_slots
-- Platform admins have unlimited leagues regardless.
--
-- Ledger table records every fulfillment so we can:
--   * make webhook / verify handlers idempotent (unique stripe_session_id)
--   * audit "who paid for what, when"
--   * support future refunds/chargebacks
-- =====================================================================


-- ---------- Column on profiles -----------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS additional_league_slots INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.additional_league_slots IS
  'Purchased extra league-creation slots. Every user starts with 1 '
  'free league; each additional league needs one slot. Incremented '
  'by the verify-league-slot-purchase edge function after a Stripe '
  'checkout completes.';


-- ---------- Ledger of slot fulfillments --------------------------------
CREATE TABLE IF NOT EXISTS public.league_slot_purchases (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id),
  stripe_session_id    TEXT NOT NULL UNIQUE,
  stripe_customer_id   TEXT,
  amount_cents         INT,
  currency             TEXT DEFAULT 'usd',
  slots_granted        INT NOT NULL DEFAULT 1,
  status               TEXT NOT NULL DEFAULT 'pending',  -- pending / paid / refunded
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_league_slot_purchases_user
  ON public.league_slot_purchases(user_id);

ALTER TABLE public.league_slot_purchases ENABLE ROW LEVEL SECURITY;

-- Users can see their own purchases. No INSERT/UPDATE from the client
-- — only the edge function (via service role) fulfills.
DROP POLICY IF EXISTS "Users can view own slot purchases"
  ON public.league_slot_purchases;
CREATE POLICY "Users can view own slot purchases"
  ON public.league_slot_purchases
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins full access to slot purchases"
  ON public.league_slot_purchases;
CREATE POLICY "Admins full access to slot purchases"
  ON public.league_slot_purchases
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


-- ---------- Capacity helper --------------------------------------------
-- Single source of truth for "can this user create another league?"
-- Returned as a row so the client can render X of Y in the paywall.
CREATE OR REPLACE FUNCTION public.get_league_creation_capacity(
  p_user_id UUID DEFAULT auth.uid()
) RETURNS TABLE (
  owned      INT,
  max_leagues INT,
  remaining  INT,
  is_admin   BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owned    INT := 0;
  v_slots    INT := 0;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;  -- empty result set for unauthenticated callers
  END IF;

  v_is_admin := public.has_role(p_user_id, 'admin'::app_role);

  SELECT COUNT(*)::INT INTO v_owned
    FROM public.leagues WHERE created_by = p_user_id;

  SELECT additional_league_slots INTO v_slots
    FROM public.profiles WHERE id = p_user_id;
  IF v_slots IS NULL THEN v_slots := 0; END IF;

  RETURN QUERY
  SELECT
    v_owned AS owned,
    CASE WHEN v_is_admin THEN 999 ELSE 1 + v_slots END AS max_leagues,
    CASE WHEN v_is_admin THEN 999 - v_owned
         ELSE GREATEST(0, (1 + v_slots) - v_owned) END AS remaining,
    v_is_admin AS is_admin;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_creation_capacity(UUID)
  TO authenticated;


-- ---------- Increment helper (service-role only, via edge function) ----
-- The edge function that fulfills a Stripe purchase calls this to bump
-- the slot count atomically. SECURITY DEFINER so it can update
-- profiles regardless of RLS. Not granted to `authenticated` — only
-- service_role can call it (the edge function uses that key).
CREATE OR REPLACE FUNCTION public.increment_league_slots(
  p_user_id UUID,
  p_delta   INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new INT;
BEGIN
  IF p_delta IS NULL OR p_delta <= 0 THEN
    RAISE EXCEPTION 'p_delta must be a positive integer'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
     SET additional_league_slots = COALESCE(additional_league_slots, 0) + p_delta,
         updated_at = NOW()
   WHERE id = p_user_id
   RETURNING additional_league_slots INTO v_new;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id
      USING ERRCODE = '02000';
  END IF;
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_league_slots(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_league_slots(UUID, INT) TO service_role;


-- ---------- Update create_league gate ----------------------------------
-- Same shape as before, but the quota check now honors purchased slots.
-- Non-admins allowed 1 free + N purchased slots.
CREATE OR REPLACE FUNCTION public.create_league(
  p_name        TEXT,
  p_description TEXT DEFAULT NULL,
  p_location    TEXT DEFAULT NULL,
  p_league_type TEXT DEFAULT 'doubles'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_is_admin   BOOLEAN;
  v_owned      INT;
  v_slots      INT := 0;
  v_max        INT;
  v_new_id     UUID;
  v_trimmed    TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  v_trimmed := TRIM(COALESCE(p_name, ''));
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'League name is required' USING ERRCODE = '22023';
  END IF;
  IF p_league_type NOT IN ('singles', 'doubles', 'team', 'flex', 'ladder') THEN
    RAISE EXCEPTION 'Invalid league_type %', p_league_type
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.has_role(v_user, 'admin'::app_role);

  IF NOT v_is_admin THEN
    SELECT COUNT(*)::INT INTO v_owned
      FROM public.leagues WHERE created_by = v_user;
    SELECT additional_league_slots INTO v_slots
      FROM public.profiles WHERE id = v_user;
    IF v_slots IS NULL THEN v_slots := 0; END IF;
    v_max := 1 + v_slots;

    IF v_owned >= v_max THEN
      RAISE EXCEPTION
        'League quota reached (owned %, max %). Buy a slot to add more.',
        v_owned, v_max
        USING ERRCODE = '53300',
              HINT   = 'league_quota_exceeded';
    END IF;
  END IF;

  INSERT INTO public.leagues
    (name, description, location, created_by, league_type,
     status, visibility)
  VALUES (
    v_trimmed,
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    NULLIF(TRIM(COALESCE(p_location, '')), ''),
    v_user,
    p_league_type::league_type,
    'draft'::league_status,
    'private'::league_visibility
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_new_id, v_user, 'league.created', 'league', v_new_id,
    jsonb_build_object(
      'name', v_trimmed,
      'league_type', p_league_type,
      'via', 'self_serve'
    )
  );

  RETURN v_new_id;
END;
$$;
