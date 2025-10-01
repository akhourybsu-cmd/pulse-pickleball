-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view match participants for matches they're involved in" ON match_participants;

-- Create a security definer function to check if a user is involved in a match
CREATE OR REPLACE FUNCTION public.user_in_match(match_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM match_participants
    WHERE match_id = match_id_param
      AND player_id = user_id_param
  );
$$;

-- Create a security definer function to check if user created the match
CREATE OR REPLACE FUNCTION public.user_created_match(match_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matches
    WHERE id = match_id_param
      AND created_by = user_id_param
  );
$$;

-- Create new policy using the security definer functions
CREATE POLICY "Users can view match participants for their matches"
ON match_participants
FOR SELECT
USING (
  public.user_in_match(match_id, auth.uid()) OR 
  public.user_created_match(match_id, auth.uid())
);