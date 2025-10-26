-- Create audit trail table for round robin edits
CREATE TABLE public.round_robin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.round_robin_events(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES public.profiles(id),
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL, -- 'event_settings', 'player_add', 'player_remove', 'schedule_edit', 'score_edit', etc.
  changes JSONB NOT NULL, -- before/after diff
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.round_robin_audit ENABLE ROW LEVEL SECURITY;

-- Organizers and admins can view audit trail for their events
CREATE POLICY "Organizers can view event audit trail"
ON public.round_robin_audit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.round_robin_events
    WHERE round_robin_events.id = round_robin_audit.event_id
    AND round_robin_events.organizer_id = auth.uid()
  )
);

-- Admins can view all audit trails
CREATE POLICY "Admins can view all audit trails"
ON public.round_robin_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit entries
CREATE POLICY "System can insert audit entries"
ON public.round_robin_audit
FOR INSERT
WITH CHECK (auth.uid() = editor_id);

-- Create index for faster queries
CREATE INDEX idx_round_robin_audit_event_id ON public.round_robin_audit(event_id);
CREATE INDEX idx_round_robin_audit_edited_at ON public.round_robin_audit(edited_at DESC);