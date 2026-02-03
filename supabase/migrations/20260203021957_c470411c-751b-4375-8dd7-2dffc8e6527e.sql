-- Create tournament email templates table
CREATE TABLE IF NOT EXISTS public.tournament_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tournaments_events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_template TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, type)
);

-- Enable RLS
ALTER TABLE public.tournament_email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Event organizers can manage their email templates
CREATE POLICY "Event organizers can manage email templates"
ON public.tournament_email_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tournaments_events te
    WHERE te.id = tournament_email_templates.event_id
    AND te.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments_events te
    WHERE te.id = tournament_email_templates.event_id
    AND te.created_by = auth.uid()
  )
);