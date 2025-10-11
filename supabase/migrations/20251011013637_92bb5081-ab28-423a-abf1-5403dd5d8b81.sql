-- Add voided status and audit fields to matches
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS voided boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS void_reason text,
ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS voided_at timestamp with time zone;

-- Create match_edits audit table
CREATE TABLE IF NOT EXISTS public.match_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  editor_id uuid NOT NULL REFERENCES auth.users(id),
  edited_at timestamp with time zone NOT NULL DEFAULT now(),
  changes jsonb NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on match_edits
ALTER TABLE public.match_edits ENABLE ROW LEVEL SECURITY;

-- Admin can view all edits
CREATE POLICY "Admins can view all match edits"
ON public.match_edits
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert edits
CREATE POLICY "System can insert match edits"
ON public.match_edits
FOR INSERT
WITH CHECK (auth.uid() = editor_id);

-- Ensure admin user exists in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'akhourybsu@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Update matches RLS to allow admins to update and delete
CREATE POLICY "Admins can update all matches"
ON public.matches
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete matches"
ON public.matches
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for match_edits
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_edits;