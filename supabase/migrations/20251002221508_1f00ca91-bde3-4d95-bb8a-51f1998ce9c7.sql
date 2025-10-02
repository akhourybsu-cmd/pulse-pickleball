-- Update RLS policies to allow anyone to create sessions
-- Only one active session per court is already enforced by unique index

-- Drop the admin-only policy for session management
DROP POLICY IF EXISTS "Admins can manage sessions" ON public.sessions;

-- Allow authenticated users to create sessions
CREATE POLICY "Authenticated users can create sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow session organizers to update their own sessions
CREATE POLICY "Organizers can update their sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- Allow session organizers to delete their own sessions
CREATE POLICY "Organizers can delete their sessions"
ON public.sessions
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Admins can still manage all sessions
CREATE POLICY "Admins can manage all sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));