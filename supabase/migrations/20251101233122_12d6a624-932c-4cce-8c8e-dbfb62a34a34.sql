-- Create enum for registration status
CREATE TYPE registration_status AS ENUM ('pending', 'confirmed', 'waitlisted', 'cancelled');

-- Create enum for payment status
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');

-- Add registration settings to tournaments_events
ALTER TABLE tournaments_events
ADD COLUMN registration_enabled boolean DEFAULT false,
ADD COLUMN registration_open_date timestamptz,
ADD COLUMN registration_close_date timestamptz,
ADD COLUMN registration_fee numeric(10,2) DEFAULT 0,
ADD COLUMN waitlist_enabled boolean DEFAULT true;

-- Create tournament_registrations table
CREATE TABLE tournament_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES tournaments_events(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES tournaments_divisions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  captain_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status registration_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  registration_date timestamptz NOT NULL DEFAULT now(),
  additional_info jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create tournament_registration_notifications table
CREATE TABLE tournament_registration_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES tournament_registrations(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  to_email text NOT NULL,
  payload jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registration_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for tournament_registrations
-- Captains can view their own registrations
CREATE POLICY "Captains can view their registrations"
ON tournament_registrations
FOR SELECT
USING (auth.uid() = captain_user_id);

-- Partners can view registrations they're part of
CREATE POLICY "Partners can view their registrations"
ON tournament_registrations
FOR SELECT
USING (auth.uid() = partner_user_id);

-- Admins can view all registrations
CREATE POLICY "Admins can view all registrations"
ON tournament_registrations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can create registrations (as captain)
CREATE POLICY "Users can create registrations"
ON tournament_registrations
FOR INSERT
WITH CHECK (auth.uid() = captain_user_id);

-- Captains can update their own pending registrations
CREATE POLICY "Captains can update their pending registrations"
ON tournament_registrations
FOR UPDATE
USING (auth.uid() = captain_user_id AND status = 'pending');

-- Admins can update all registrations
CREATE POLICY "Admins can update all registrations"
ON tournament_registrations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Captains can delete their own pending registrations (cancel)
CREATE POLICY "Captains can cancel pending registrations"
ON tournament_registrations
FOR DELETE
USING (auth.uid() = captain_user_id AND status = 'pending');

-- Admins can delete any registration
CREATE POLICY "Admins can delete registrations"
ON tournament_registrations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for tournament_registration_notifications
-- Only admins can view notifications
CREATE POLICY "Admins can view all notifications"
ON tournament_registration_notifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON tournament_registration_notifications
FOR INSERT
WITH CHECK (true);

-- Create updated_at trigger for tournament_registrations
CREATE TRIGGER update_tournament_registrations_updated_at
BEFORE UPDATE ON tournament_registrations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Create indexes for better query performance
CREATE INDEX idx_tournament_registrations_event ON tournament_registrations(event_id);
CREATE INDEX idx_tournament_registrations_division ON tournament_registrations(division_id);
CREATE INDEX idx_tournament_registrations_captain ON tournament_registrations(captain_user_id);
CREATE INDEX idx_tournament_registrations_partner ON tournament_registrations(partner_user_id);
CREATE INDEX idx_tournament_registrations_status ON tournament_registrations(status);
CREATE INDEX idx_tournament_registration_notifications_registration ON tournament_registration_notifications(registration_id);