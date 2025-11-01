-- Fix search_path for update_divisions_updated_at function
DROP TRIGGER IF EXISTS trigger_divisions_updated_at ON tournaments_divisions;
DROP FUNCTION IF EXISTS update_divisions_updated_at();

CREATE OR REPLACE FUNCTION update_divisions_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_divisions_updated_at
  BEFORE UPDATE ON tournaments_divisions
  FOR EACH ROW
  EXECUTE FUNCTION update_divisions_updated_at();