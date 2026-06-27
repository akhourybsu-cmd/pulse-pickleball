GRANT SELECT ON public.venues TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;