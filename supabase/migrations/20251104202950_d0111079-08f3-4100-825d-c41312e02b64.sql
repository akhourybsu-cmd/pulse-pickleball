-- Add DELETE policies so users can check themselves out

-- Allow users to delete their own check-ins
CREATE POLICY "Users can delete their own check-ins"
ON public.check_ins
FOR DELETE
TO public
USING (auth.uid() = player_id);

-- Allow users to delete their own queue entries
CREATE POLICY "Users can delete their own queue entries"
ON public.queue_entries
FOR DELETE
TO public
USING (auth.uid() = player_id);