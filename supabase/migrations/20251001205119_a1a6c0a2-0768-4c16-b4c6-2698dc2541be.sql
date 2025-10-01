-- Add trigger to recalculate stats when new approved matches are inserted
CREATE OR REPLACE FUNCTION public.handle_match_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_record RECORD;
BEGIN
  -- Only recalculate if the match is approved
  IF NEW.status = 'approved' THEN
    FOR participant_record IN 
      SELECT DISTINCT player_id 
      FROM match_participants 
      WHERE match_id = NEW.id
    LOOP
      PERFORM recalculate_player_stats(participant_record.player_id);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT on matches
DROP TRIGGER IF EXISTS on_match_insert ON public.matches;
CREATE TRIGGER on_match_insert
AFTER INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_insert();

-- Recalculate all player stats to fix existing data
SELECT recalculate_all_player_stats();