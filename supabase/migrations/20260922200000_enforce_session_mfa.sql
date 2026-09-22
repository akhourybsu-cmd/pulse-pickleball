-- Application MFA is enforced in PostgREST, row policies and caller-scoped
-- Edge checks. Email verification is PULSE session assurance, not an aal2 JWT.
CREATE SCHEMA IF NOT EXISTS pulse_security;
REVOKE ALL ON SCHEMA pulse_security FROM PUBLIC, anon, authenticated;

CREATE TABLE pulse_security.email_proofs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  email text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, session_id)
);
CREATE TABLE pulse_security.email_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('sign_in', 'enroll')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  UNIQUE (user_id, session_id, purpose)
);
CREATE TABLE pulse_security.email_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started timestamptz NOT NULL DEFAULT now(),
  sends integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0
);
REVOKE ALL ON ALL TABLES IN SCHEMA pulse_security FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pulse_mfa_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid(); sid uuid; method text; account_email text;
  native_factor boolean; proof_until timestamptz;
BEGIN
  IF uid IS NULL OR auth.role() <> 'authenticated' THEN
    RETURN jsonb_build_object('method', 'none', 'verified', false, 'error', 'sign_in_required');
  END IF;
  BEGIN sid := nullif(auth.jwt()->>'session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN sid := NULL; END;
  IF sid IS NULL OR NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = sid AND user_id = uid) THEN
    RETURN jsonb_build_object('method', 'none', 'verified', false, 'error', 'sign_in_required');
  END IF;
  SELECT email INTO account_email FROM auth.users WHERE id = uid;
  SELECT coalesce(mfa_method, 'none') INTO method FROM public.profiles WHERE id = uid;
  method := coalesce(method, 'none');
  SELECT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = uid AND status = 'verified') INTO native_factor;
  -- The authoritative factor registry wins over an editable/stale profile label.
  IF native_factor OR method = 'authenticator' THEN
    RETURN jsonb_build_object('method', 'authenticator', 'verified', coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2', 'userId', uid, 'sessionId', sid);
  END IF;
  IF method = 'email' THEN
    SELECT expires_at INTO proof_until FROM pulse_security.email_proofs
      WHERE user_id = uid AND session_id = sid AND email = account_email AND expires_at > now();
    RETURN jsonb_build_object('method', 'email', 'verified', proof_until IS NOT NULL, 'expiresAt', proof_until, 'userId', uid, 'sessionId', sid);
  END IF;
  RETURN jsonb_build_object('method', method, 'verified', method = 'none', 'userId', uid, 'sessionId', sid);
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_mfa_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pulse_mfa_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.pulse_has_required_mfa()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((public.pulse_mfa_status()->>'verified')::boolean, false)
$$;
REVOKE ALL ON FUNCTION public.pulse_has_required_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pulse_has_required_mfa() TO authenticated;

CREATE OR REPLACE FUNCTION public.pulse_issue_mfa_email(p_user_id uuid, p_session_id uuid, p_challenge_id uuid, p_code_hash text, p_purpose text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text; v_method text; v_limit pulse_security.email_limits%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501'; END IF;
  IF p_purpose NOT IN ('sign_in', 'enroll') OR p_purpose IS NULL OR p_challenge_id IS NULL OR p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL OR NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = p_session_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required');
  END IF;
  SELECT coalesce(mfa_method, 'none') INTO v_method FROM public.profiles WHERE id = p_user_id;
  IF v_method IS NULL OR (p_purpose = 'sign_in' AND v_method <> 'email') OR (p_purpose = 'enroll' AND v_method <> 'none')
      OR EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = p_user_id AND status = 'verified') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'method_changed');
  END IF;
  INSERT INTO pulse_security.email_limits(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_limit FROM pulse_security.email_limits WHERE user_id = p_user_id FOR UPDATE;
  IF v_limit.window_started <= now() - interval '10 minutes' THEN
    UPDATE pulse_security.email_limits SET window_started = now(), sends = 0, failures = 0 WHERE user_id = p_user_id;
    v_limit.sends := 0; v_limit.failures := 0;
  END IF;
  IF v_limit.sends >= 5 OR v_limit.failures >= 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'rate_limited'); END IF;
  UPDATE pulse_security.email_limits SET sends = sends + 1 WHERE user_id = p_user_id;
  INSERT INTO pulse_security.email_challenges(id, user_id, session_id, email, code_hash, purpose, expires_at)
    VALUES(p_challenge_id, p_user_id, p_session_id, v_email, p_code_hash, p_purpose, now() + interval '10 minutes')
    ON CONFLICT (user_id, session_id, purpose) DO UPDATE SET id = excluded.id, email = excluded.email,
      code_hash = excluded.code_hash, expires_at = excluded.expires_at, consumed_at = NULL;
  RETURN jsonb_build_object('ok', true, 'email', v_email, 'challengeId', p_challenge_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_verify_mfa_email(p_user_id uuid, p_session_id uuid, p_challenge_id uuid, p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_challenge pulse_security.email_challenges%ROWTYPE; v_limit pulse_security.email_limits%ROWTYPE; v_method text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_limit FROM pulse_security.email_limits WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_code'); END IF;
  IF v_limit.window_started <= now() - interval '10 minutes' THEN
    UPDATE pulse_security.email_limits SET window_started = now(), sends = 0, failures = 0 WHERE user_id = p_user_id;
    v_limit.failures := 0;
  END IF;
  IF v_limit.failures >= 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'rate_limited'); END IF;
  SELECT * INTO v_challenge FROM pulse_security.email_challenges WHERE id = p_challenge_id AND user_id = p_user_id AND session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_challenge.code_hash IS DISTINCT FROM p_code_hash OR v_challenge.consumed_at IS NOT NULL OR v_challenge.expires_at <= now()
      OR NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = p_session_id AND user_id = p_user_id)
      OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND email = v_challenge.email AND email_confirmed_at IS NOT NULL) THEN
    -- Return instead of raising: failed-attempt increments must commit.
    UPDATE pulse_security.email_limits SET failures = failures + 1 WHERE user_id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  SELECT coalesce(mfa_method, 'none') INTO v_method FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_method IS NULL OR (v_challenge.purpose = 'enroll' AND v_method <> 'none') OR (v_challenge.purpose = 'sign_in' AND v_method <> 'email')
      OR EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = p_user_id AND status = 'verified') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'method_changed');
  END IF;
  UPDATE pulse_security.email_challenges SET consumed_at = now() WHERE id = p_challenge_id;
  INSERT INTO pulse_security.email_proofs(user_id, session_id, email, expires_at)
    VALUES(p_user_id, p_session_id, v_challenge.email, now() + interval '12 hours')
    ON CONFLICT (user_id, session_id) DO UPDATE SET email = excluded.email, verified_at = now(), expires_at = excluded.expires_at;
  IF v_challenge.purpose = 'enroll' THEN UPDATE public.profiles SET mfa_method = 'email' WHERE id = p_user_id; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_cancel_mfa_email(p_challenge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501'; END IF;
  DELETE FROM pulse_security.email_challenges WHERE id = p_challenge_id AND consumed_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_issue_mfa_email(uuid, uuid, uuid, text, text), public.pulse_verify_mfa_email(uuid, uuid, uuid, text), public.pulse_cancel_mfa_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_issue_mfa_email(uuid, uuid, uuid, text, text), public.pulse_verify_mfa_email(uuid, uuid, uuid, text), public.pulse_cancel_mfa_email(uuid) TO service_role;

-- Retire the callable legacy code minting/verification surface.
REVOKE ALL ON FUNCTION public.insert_mfa_code(uuid, text, text, timestamptz), public.verify_and_use_mfa_code(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.mfa_verification_codes FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION pulse_security.protect_mfa_setting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.mfa_method IS NOT DISTINCT FROM OLD.mfa_method OR auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS DISTINCT FROM OLD.id OR NOT public.pulse_has_required_mfa() THEN
    RAISE EXCEPTION 'MFA verification required' USING ERRCODE = '42501';
  END IF;
  IF NEW.mfa_method = 'none' THEN
    IF EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = OLD.id AND status = 'verified') THEN
      RAISE EXCEPTION 'Unenroll verified authenticator factors first' USING ERRCODE = '42501';
    END IF;
    DELETE FROM pulse_security.email_proofs WHERE user_id = OLD.id;
    DELETE FROM pulse_security.email_challenges WHERE user_id = OLD.id;
  ELSIF NEW.mfa_method = 'authenticator' AND auth.jwt()->>'aal' = 'aal2'
      AND EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = OLD.id AND status = 'verified') THEN
    NULL;
  ELSE RAISE EXCEPTION 'Use verified MFA enrollment' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_mfa_setting BEFORE UPDATE OF mfa_method ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION pulse_security.protect_mfa_setting();

-- Restrictive policies compose with existing authorization rather than
-- replacing it. For tables without RLS, preserve their existing grant-based
-- access, then apply MFA only to authenticated callers.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT c.oid, n.nspname, c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p') AND (n.nspname = 'public' OR (n.nspname = 'storage' AND c.relname = 'objects') OR (n.nspname = 'realtime' AND c.relname = 'messages')) LOOP
    IF NOT t.relrowsecurity THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.nspname, t.relname);
      EXECUTE format('CREATE POLICY pulse_existing_grants ON %I.%I AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true)', t.nspname, t.relname);
    END IF;
    EXECUTE format('CREATE POLICY pulse_required_mfa ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.pulse_has_required_mfa())) WITH CHECK ((SELECT public.pulse_has_required_mfa()))', t.nspname, t.relname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.pulse_enforce_mfa()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() = 'authenticated'
      AND coalesce(current_setting('request.path', true), '') <> '/rpc/pulse_mfa_status'
      AND NOT public.pulse_has_required_mfa() THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_enforce_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pulse_enforce_mfa() TO anon, authenticated, service_role;
-- Fail safely if an environment already uses another pre-request hook. Chain
-- that hook explicitly instead of silently replacing its security checks.
DO $$ DECLARE existing text; BEGIN
  SELECT split_part(setting, '=', 2) INTO existing FROM pg_roles r, unnest(r.rolconfig) setting
    WHERE r.rolname = 'authenticator' AND setting LIKE 'pgrst.db_pre_request=%';
  IF existing IS NOT NULL AND existing NOT IN ('', 'public.pulse_enforce_mfa') THEN
    RAISE EXCEPTION 'Existing PostgREST pre-request hook must be chained: %', existing;
  END IF;
END $$;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.pulse_enforce_mfa';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
