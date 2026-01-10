-- =============================================
-- PULSE Enterprise Upgrade - Foundation Migration
-- =============================================

-- Phase 3: Waitlist Automation Tables
-- Add promotion tracking to event_registrations
ALTER TABLE event_registrations 
ADD COLUMN IF NOT EXISTS promotion_deadline timestamptz,
ADD COLUMN IF NOT EXISTS promotion_notified_at timestamptz,
ADD COLUMN IF NOT EXISTS auto_expired boolean DEFAULT false;

-- Create waitlist settings table
CREATE TABLE IF NOT EXISTS waitlist_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES unified_events(id) ON DELETE CASCADE,
  promotion_window_hours int DEFAULT 12,
  auto_promote boolean DEFAULT true,
  notify_on_promotion boolean DEFAULT true,
  charge_on_promotion boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id)
);

ALTER TABLE waitlist_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can manage waitlist settings" ON waitlist_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM unified_events ue
      WHERE ue.id = waitlist_settings.event_id
      AND has_venue_access(auth.uid(), ue.host_venue_id)
    )
  );

-- Phase 4: Venue Following System
CREATE TABLE IF NOT EXISTS venue_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  followed_at timestamptz DEFAULT now(),
  notify_new_events boolean DEFAULT true,
  notify_announcements boolean DEFAULT true,
  notify_schedule_changes boolean DEFAULT true,
  UNIQUE(venue_id, user_id)
);

ALTER TABLE venue_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can follow venues" ON venue_followers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can see own follows" ON venue_followers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own follows" ON venue_followers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can unfollow" ON venue_followers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Venue staff can see their followers" ON venue_followers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venue_staff vs 
      WHERE vs.venue_id = venue_followers.venue_id 
      AND vs.user_id = auth.uid() 
      AND vs.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM venues v 
      WHERE v.id = venue_followers.venue_id 
      AND v.owner_id = auth.uid()
    )
  );

-- Venue Announcements Table
CREATE TABLE IF NOT EXISTS venue_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  target_audience text DEFAULT 'followers' CHECK (target_audience IN ('followers', 'past_attendees', 'all')),
  channels text[] DEFAULT ARRAY['in_app'],
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count int DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE venue_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can manage announcements" ON venue_announcements
  FOR ALL USING (has_venue_access(auth.uid(), venue_id));

CREATE POLICY "Users can see sent announcements for followed venues" ON venue_announcements
  FOR SELECT USING (
    sent_at IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM venue_followers vf 
      WHERE vf.venue_id = venue_announcements.venue_id 
      AND vf.user_id = auth.uid()
    )
  );

-- Phase 6: Financial Governance
CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  event_id uuid REFERENCES unified_events(id) ON DELETE SET NULL,
  registration_id uuid,
  user_id uuid,
  transaction_type text NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'payout', 'credit', 'fee')),
  amount_cents int NOT NULL,
  currency text DEFAULT 'usd',
  stripe_payment_intent_id text,
  stripe_refund_id text,
  stripe_payout_id text,
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  failure_reason text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can view their transactions" ON financial_transactions
  FOR SELECT USING (
    venue_id IS NOT NULL AND has_venue_access(auth.uid(), venue_id)
  );

CREATE POLICY "Users can view their own transactions" ON financial_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all transactions" ON financial_transactions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_venue ON financial_transactions(venue_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_event ON financial_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user ON financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_venue_followers_venue ON venue_followers(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_followers_user ON venue_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_waitlist ON event_registrations(event_id, status, waitlist_position) WHERE waitlist_position IS NOT NULL;

-- Helper function to get follower count
CREATE OR REPLACE FUNCTION get_venue_follower_count(p_venue_id uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int FROM venue_followers WHERE venue_id = p_venue_id;
$$;

-- Function to promote next waitlisted registration
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_registration_id uuid;
  v_settings waitlist_settings%ROWTYPE;
BEGIN
  -- Get waitlist settings
  SELECT * INTO v_settings FROM waitlist_settings WHERE event_id = p_event_id;
  
  -- Find next waitlisted registration (FIFO)
  SELECT id INTO v_next_registration_id
  FROM event_registrations
  WHERE event_id = p_event_id
    AND status = 'waitlisted'
    AND auto_expired = false
  ORDER BY waitlist_position ASC, registered_at ASC
  LIMIT 1;
  
  IF v_next_registration_id IS NOT NULL THEN
    -- Promote to confirmed
    UPDATE event_registrations
    SET 
      status = 'confirmed',
      promoted_at = now(),
      promotion_deadline = CASE 
        WHEN v_settings.promotion_window_hours > 0 
        THEN now() + (v_settings.promotion_window_hours || ' hours')::interval
        ELSE NULL
      END,
      waitlist_position = NULL
    WHERE id = v_next_registration_id;
    
    -- Update remaining waitlist positions
    UPDATE event_registrations
    SET waitlist_position = waitlist_position - 1
    WHERE event_id = p_event_id
      AND status = 'waitlisted'
      AND waitlist_position IS NOT NULL;
  END IF;
  
  RETURN v_next_registration_id;
END;
$$;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_enterprise_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS update_waitlist_settings_timestamp ON waitlist_settings;
CREATE TRIGGER update_waitlist_settings_timestamp
  BEFORE UPDATE ON waitlist_settings
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_timestamps();

DROP TRIGGER IF EXISTS update_venue_announcements_timestamp ON venue_announcements;
CREATE TRIGGER update_venue_announcements_timestamp
  BEFORE UPDATE ON venue_announcements
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_timestamps();

DROP TRIGGER IF EXISTS update_financial_transactions_timestamp ON financial_transactions;
CREATE TRIGGER update_financial_transactions_timestamp
  BEFORE UPDATE ON financial_transactions
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_timestamps();