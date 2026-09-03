-- Remove obsolete or duplicate permissive INSERT policies.
--
-- Direct conversation creation has been replaced by the guarded
-- get_or_create_dm_conversation RPC. court_channels is not written by the
-- current application. Venue inquiry lead capture remains public through the
-- original "Anyone can submit venue inquiry" policy; the later duplicate is
-- unnecessary.

DROP POLICY IF EXISTS "Users can create conversations"
  ON public.conversations;

DROP POLICY IF EXISTS "Authenticated users can create court channels"
  ON public.court_channels;

DROP POLICY IF EXISTS "Anyone can insert venue inquiries"
  ON public.venue_inquiries;
