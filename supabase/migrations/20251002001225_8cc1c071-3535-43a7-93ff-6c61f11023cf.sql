-- Create trigger for match insertion
CREATE OR REPLACE TRIGGER on_match_insert
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_insert();

-- Create trigger for match status changes
CREATE OR REPLACE TRIGGER on_match_status_change
  AFTER UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_status_change();

-- Create trigger for match deletion
CREATE OR REPLACE TRIGGER on_match_delete
  AFTER DELETE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_deletion();

-- Recalculate stats for all players to fix current data
SELECT recalculate_all_player_stats();