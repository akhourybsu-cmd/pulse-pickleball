-- Nullable overrides preserve automatic light/dark defaults. Existing venue
-- owner/manager UPDATE policies and MFA restrictions govern these fields.
ALTER TABLE public.venues
  ADD COLUMN chat_background_color text,
  ADD COLUMN chat_incoming_color text,
  ADD COLUMN chat_outgoing_color text,
  ADD CONSTRAINT venues_chat_background_color_hex CHECK (chat_background_color IS NULL OR chat_background_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'),
  ADD CONSTRAINT venues_chat_incoming_color_hex CHECK (chat_incoming_color IS NULL OR chat_incoming_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'),
  ADD CONSTRAINT venues_chat_outgoing_color_hex CHECK (chat_outgoing_color IS NULL OR chat_outgoing_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$');
