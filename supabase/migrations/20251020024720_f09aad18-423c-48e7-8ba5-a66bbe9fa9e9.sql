-- Drop the existing policy that depends on verified_by
DROP POLICY IF EXISTS "Players can update verified_by for their matches" ON public.matches;

-- Convert verified_by from uuid[] to text[] with direct casting
ALTER TABLE public.matches
  ALTER COLUMN verified_by TYPE text[] 
  USING verified_by::text[];

-- Set default value
ALTER TABLE public.matches
  ALTER COLUMN verified_by SET DEFAULT '{}'::text[];

-- Update any NULL values to empty array
UPDATE public.matches 
SET verified_by = '{}'::text[]
WHERE verified_by IS NULL;

-- Recreate the policy for participants to update verified_by
CREATE POLICY "Participants can update verified_by"
ON public.matches
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = matches.id
      AND mp.player_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = matches.id
      AND mp.player_id = auth.uid()
  )
);

-- RPC function to safely append and dedupe verified_by
CREATE OR REPLACE FUNCTION public.verify_match(p_match_id uuid)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches;
BEGIN
  -- Only allow if caller is a participant in the match
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = p_match_id 
      AND mp.player_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant in this match';
  END IF;

  -- Update verified_by with deduplicated array including caller
  UPDATE public.matches
  SET verified_by = (
    SELECT array_agg(DISTINCT v)
    FROM unnest(COALESCE(verified_by, '{}'::text[]) || auth.uid()::text) AS v
  )
  WHERE id = p_match_id
  RETURNING * INTO m;

  RETURN m;
END;
$$;