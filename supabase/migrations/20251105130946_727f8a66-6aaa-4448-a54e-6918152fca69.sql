-- Create admin audit log table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX idx_admin_audit_log_admin_user ON public.admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_resource ON public.admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log(action);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.admin_audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- System can insert audit logs (via security definer function)
CREATE POLICY "System can insert audit logs"
  ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
CREATE POLICY "Audit logs are immutable"
  ON public.admin_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON public.admin_audit_log
  FOR DELETE
  USING (false);

-- Create security definer function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Only allow if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create function for GDPR data export
CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_export JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Compile all user data
  v_export := jsonb_build_object(
    'export_date', now(),
    'user_id', v_user_id,
    'profile', (
      SELECT to_jsonb(p.*) 
      FROM profiles p 
      WHERE p.id = v_user_id
    ),
    'matches_participated', (
      SELECT jsonb_agg(to_jsonb(m.*))
      FROM matches m
      JOIN match_participants mp ON mp.match_id = m.id
      WHERE mp.player_id = v_user_id
    ),
    'match_participants', (
      SELECT jsonb_agg(to_jsonb(mp.*))
      FROM match_participants mp
      WHERE mp.player_id = v_user_id
    ),
    'badges', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'badge', b.*,
          'earned_at', pb.earned_at,
          'progress', pb.progress
        )
      )
      FROM player_badges pb
      JOIN badges b ON b.id = pb.badge_id
      WHERE pb.player_id = v_user_id
    ),
    'queue_entries', (
      SELECT jsonb_agg(to_jsonb(qe.*))
      FROM queue_entries qe
      WHERE qe.player_id = v_user_id
    ),
    'round_robin_participation', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'event', e.*,
          'participation', rp.*
        )
      )
      FROM round_robin_players rp
      JOIN round_robin_events e ON e.id = rp.event_id
      WHERE rp.player_id = v_user_id
    ),
    'tournament_registrations', (
      SELECT jsonb_agg(to_jsonb(tr.*))
      FROM tournament_registrations tr
      WHERE tr.captain_user_id = v_user_id
         OR tr.partner_user_id = v_user_id
    ),
    'calendar_registrations', (
      SELECT jsonb_agg(to_jsonb(cer.*))
      FROM calendar_event_registrations cer
      WHERE cer.user_id = v_user_id
    ),
    'citi_event_attendance', (
      SELECT jsonb_agg(to_jsonb(cea.*))
      FROM citi_event_attendees cea
      WHERE cea.user_id = v_user_id
    ),
    'court_posts', (
      SELECT jsonb_agg(to_jsonb(cp.*))
      FROM court_posts cp
      WHERE cp.author_user_id = v_user_id
    ),
    'court_post_comments', (
      SELECT jsonb_agg(to_jsonb(cpc.*))
      FROM court_post_comments cpc
      WHERE cpc.author_user_id = v_user_id
    ),
    'lfg_posts', (
      SELECT jsonb_agg(to_jsonb(lfg.*))
      FROM lfg_posts lfg
      WHERE lfg.created_by = v_user_id
    ),
    'contested_matches', (
      SELECT jsonb_agg(to_jsonb(cm.*))
      FROM contested_matches cm
      WHERE cm.contested_by = v_user_id
    ),
    'match_issues', (
      SELECT jsonb_agg(to_jsonb(mi.*))
      FROM match_issues mi
      WHERE mi.reported_by = v_user_id
    )
  );
  
  RETURN v_export;
END;
$$;