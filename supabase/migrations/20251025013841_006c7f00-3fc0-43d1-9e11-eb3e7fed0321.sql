-- Create missing LFG and availability tables
CREATE TABLE IF NOT EXISTS user_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, day_of_week, start_time, end_time)
);

-- Enable RLS
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_availability
CREATE POLICY "Users can view their own availability"
  ON user_availability FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own availability"
  ON user_availability FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_availability_user ON user_availability(user_id);
