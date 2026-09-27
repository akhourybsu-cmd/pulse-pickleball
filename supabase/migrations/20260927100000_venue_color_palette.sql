-- Optional roles retain existing primary/secondary branding as their fallback.
-- Existing venue owner/manager policies continue to govern these profile fields.
ALTER TABLE public.venues
  ADD COLUMN accent_color text,
  ADD COLUMN background_color text,
  ADD COLUMN surface_color text,
  ADD COLUMN text_color text,
  ADD COLUMN logo_background_color text,
  ADD CONSTRAINT venues_palette_hex CHECK (
    (accent_color IS NULL OR accent_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$') AND
    (background_color IS NULL OR background_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$') AND
    (surface_color IS NULL OR surface_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$') AND
    (text_color IS NULL OR text_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$') AND
    (logo_background_color IS NULL OR logo_background_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')
  );
