-- Trigger functions execute through their attached triggers and do not need
-- direct EXECUTE grants for client-facing roles. Remove those unnecessary
-- grants from every SECURITY DEFINER trigger function in the exposed public
-- schema. This leaves trigger behavior and owner/service access unchanged.

DO $$
DECLARE
  function_signature regprocedure;
BEGIN
  FOR function_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_signature
    );
  END LOOP;
END;
$$;
