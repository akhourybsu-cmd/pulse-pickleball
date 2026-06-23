CREATE OR REPLACE FUNCTION public.is_valid_push_dispatch_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(p_secret, '') <> ''
    AND EXISTS (
      SELECT 1
      FROM private.app_config
      WHERE key = 'push_dispatch_secret'
        AND value = p_secret
    );
$$;

REVOKE ALL ON FUNCTION public.is_valid_push_dispatch_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_push_dispatch_secret(text) TO service_role;