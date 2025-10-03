-- Update existing venue_hopper badge to court_hopper
UPDATE badges 
SET code = 'court_hopper',
    name = 'Court Hopper',
    description = 'Win at 3 distinct courts'
WHERE code = 'venue_hopper';

-- Insert new badges for first game and unique opponents
INSERT INTO badges (code, name, description, category, tier, icon) VALUES
  ('first_game', 'First Game', 'Record your first game in the PULSE system', 'streaks', 1, '🎯'),
  ('social_butterfly_1', 'Social Butterfly I', 'Play a game with 6 different unique people', 'duos', 1, '🦋'),
  ('social_butterfly_2', 'Social Butterfly II', 'Play a game with 18 different unique people', 'duos', 2, '🦋'),
  ('social_butterfly_3', 'Social Butterfly III', 'Play a game with 36 different unique people', 'duos', 3, '🦋')
ON CONFLICT (code) DO NOTHING;