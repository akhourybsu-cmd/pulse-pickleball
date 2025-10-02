-- Create badges table to define all available badges
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- e.g., 'daily_grinder_1', 'weekly_warrior'
  name TEXT NOT NULL, -- Display name
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'streaks', 'ratings', 'quality', 'opponent_strength', 'duos', 'sportsmanship'
  tier INTEGER DEFAULT 1, -- For tiered badges (I, II, III)
  icon TEXT, -- Icon identifier for UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create player_badges table to track earned badges
CREATE TABLE public.player_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  progress JSONB, -- Store progress data (e.g., current streak count)
  UNIQUE(player_id, badge_id)
);

-- Enable RLS on both tables
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_badges ENABLE ROW LEVEL SECURITY;

-- RLS policies for badges
CREATE POLICY "Badges are viewable by everyone"
ON public.badges FOR SELECT
USING (true);

-- RLS policies for player_badges
CREATE POLICY "Player badges are viewable by everyone"
ON public.player_badges FOR SELECT
USING (true);

CREATE POLICY "System can insert player badges"
ON public.player_badges FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update player badges"
ON public.player_badges FOR UPDATE
USING (true);

-- Add indexes for performance
CREATE INDEX idx_player_badges_player_id ON public.player_badges(player_id);
CREATE INDEX idx_player_badges_badge_id ON public.player_badges(badge_id);
CREATE INDEX idx_player_badges_earned_at ON public.player_badges(earned_at);

-- Insert all badge definitions
INSERT INTO public.badges (code, name, description, category, tier) VALUES
-- Streaks & Commitment
('daily_grinder_1', 'Daily Grinder I', 'Play an approved game 3 consecutive days', 'streaks', 1),
('daily_grinder_2', 'Daily Grinder II', 'Play an approved game 7 consecutive days', 'streaks', 2),
('daily_grinder_3', 'Daily Grinder III', 'Play an approved game 30 consecutive days', 'streaks', 3),
('weekly_warrior', 'Weekly Warrior', 'Play in 4 consecutive calendar weeks', 'streaks', 1),
('iron_day', 'Iron Day', 'Play 8+ approved games on the same calendar day', 'streaks', 1),
('partner_explorer_1', 'Partner Explorer I', 'Win games with 5 different partners', 'streaks', 1),
('partner_explorer_2', 'Partner Explorer II', 'Win games with 12 different partners', 'streaks', 2),
('venue_hopper', 'Venue Hopper', 'Win at 3 distinct venues', 'streaks', 1),
('fast_confirmer', 'Fast Confirmer', 'Confirm a submission within 15 minutes 5 times', 'streaks', 1),
('early_bird', 'Early Bird', 'Be part of the first approved game of a day 5 times', 'streaks', 1),
('night_owl', 'Night Owl', 'Be part of the last approved game of a day 5 times', 'streaks', 1),

-- Ratings & Progress
('over_three_club', 'Over Three Club', 'Maintain rating ≥ 3.00 for 30 straight days', 'ratings', 1),
('steady_three_five', 'Steady Three-Five', 'Maintain rating ≥ 3.50 for 30 days', 'ratings', 1),
('steady_four_oh', 'Steady Four-Oh', 'Maintain rating ≥ 4.00 for 30 days', 'ratings', 2),
('riser_1', 'Riser I', 'Gain +0.50 rating over 30 days', 'ratings', 1),
('riser_2', 'Riser II', 'Gain +1.00 rating over 30 days', 'ratings', 2),
('riser_3', 'Riser III', 'Gain +2.00 rating over 30 days', 'ratings', 3),
('hot_hand', 'Hot Hand', 'Gain +0.20 rating within one calendar day', 'ratings', 1),
('slump_buster', 'Slump Buster', 'After 3 consecutive losses, win the next game', 'ratings', 1),
('rock_solid', 'Rock Solid', '≥ 60% win rate across last 30 games', 'ratings', 1),

-- Game Quality & Margins
('shutout', 'Shutout', 'Win 11-0 in a game', 'quality', 1),
('lockdown', 'Lockdown', 'Hold opponents to ≤ 4 points in a game', 'quality', 1),
('nail_biter', 'Nail-Biter', 'Win a game by exactly 2 in extra points (e.g., 12-10, 13-11)', 'quality', 1),
('marathon', 'Marathon', 'Win any game that reaches 14+ points', 'quality', 1),
('day_sweeper', 'Day Sweeper', 'Go 5-0 in approved games on the same calendar day', 'quality', 1),

-- Strength of Opponent
('upset_alert', 'Upset Alert', 'Win a game when your team win probability < 35%', 'opponent_strength', 1),
('giant_killer', 'Giant Killer', 'Win a game when your team win probability < 25%', 'opponent_strength', 2),
('dragon_slayer', 'Dragon Slayer', 'Beat a team with avg opponent rating ≥ 0.30 higher', 'opponent_strength', 3),

-- Rivals & Duos
('dynamic_duo', 'Dynamic Duo', '5-0 with the same partner in last 10 games together', 'duos', 1),
('power_pair', 'Power Pair', '20 wins with same partner and ≥ 70% win rate together', 'duos', 2),
('rivalry_settled', 'Rivalry Settled', '3 wins over the same opposing pair', 'duos', 1),
('mentor', 'Mentor', '5 wins with partners ≥ 0.20 rating below you', 'duos', 1),

-- Sportsmanship & Community
('clean_sheet', 'Clean Sheet', '0 rejected submissions & 0 lost disputes over last 60 days', 'sportsmanship', 1),
('model_citizen', 'Model Citizen', '≥ 90% of confirmations done within 24h over last 60 days', 'sportsmanship', 1),
('reporter', 'Reporter', '10 public score reports that get approved', 'sportsmanship', 1),
('ambassador', 'Ambassador', '3 referred players who each complete 1 approved game', 'sportsmanship', 1);

-- Function to calculate expected win probability (logistic curve)
CREATE OR REPLACE FUNCTION public.calculate_win_probability(
  player_rating NUMERIC,
  partner_rating NUMERIC,
  opponent1_rating NUMERIC,
  opponent2_rating NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_avg NUMERIC;
  opponent_avg NUMERIC;
  tau NUMERIC := 0.4; -- From rating_parameters
BEGIN
  team_avg := (player_rating + partner_rating) / 2.0;
  opponent_avg := (opponent1_rating + opponent2_rating) / 2.0;
  
  -- Expected win probability: 1 / (1 + 10^((opponent_avg - team_avg) / tau))
  RETURN 1.0 / (1.0 + POWER(10, (opponent_avg - team_avg) / tau));
END;
$$;

-- Function to get partner from a match for a specific player
CREATE OR REPLACE FUNCTION public.get_partner_id(
  match_id_param UUID,
  player_id_param UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mp.player_id
  FROM match_participants mp
  WHERE mp.match_id = match_id_param
    AND mp.player_id != player_id_param
    AND mp.team = (
      SELECT team FROM match_participants 
      WHERE match_id = match_id_param AND player_id = player_id_param
    )
  LIMIT 1;
$$;

-- Function to check and award badges for a player
CREATE OR REPLACE FUNCTION public.check_and_award_badges(player_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge_record RECORD;
  should_award BOOLEAN;
BEGIN
  -- This function will be called by an edge function that implements
  -- the complex badge logic. For now, it's a placeholder that allows
  -- the edge function to award badges.
  NULL;
END;
$$;