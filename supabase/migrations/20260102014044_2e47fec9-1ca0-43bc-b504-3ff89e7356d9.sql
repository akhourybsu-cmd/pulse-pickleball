-- Allow creators to always view their own groups (fixes RLS error on insert+select for non-public groups)
CREATE POLICY "Creators can view their groups"
  ON public.groups FOR SELECT
  USING (auth.uid() = created_by);