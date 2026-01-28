-- Add new activation state for unverified venues
ALTER TYPE venue_activation_state ADD VALUE IF NOT EXISTS 'pending_verification' BEFORE 'pending';

-- Add verification tracking columns to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_approved_at timestamptz;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_approved_by uuid REFERENCES auth.users(id);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_player_profile boolean DEFAULT true;

-- Create index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_venues_activation_state ON venues(activation_state);