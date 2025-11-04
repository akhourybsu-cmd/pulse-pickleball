-- Add format field to round_robin_events
ALTER TABLE round_robin_events
ADD COLUMN format text NOT NULL DEFAULT 'open'
CHECK (format IN ('open', 'mixed', 'male', 'female'));

COMMENT ON COLUMN round_robin_events.format IS 'Format type: open (no gender requirement), mixed (1 male + 1 female per team), male (male only), female (female only)';