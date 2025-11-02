
-- Enable realtime for court_channels table (was missing)
ALTER PUBLICATION supabase_realtime ADD TABLE public.court_channels;
