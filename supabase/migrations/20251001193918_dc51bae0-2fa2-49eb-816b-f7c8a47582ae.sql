-- Enable RLS on rating_parameters table
ALTER TABLE public.rating_parameters ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read rating parameters (they're system-wide constants)
CREATE POLICY "Rating parameters are viewable by everyone"
ON public.rating_parameters
FOR SELECT
USING (true);

-- Only allow system/admin updates (no one can update through the app)
-- In the future, you could add an admin role check here