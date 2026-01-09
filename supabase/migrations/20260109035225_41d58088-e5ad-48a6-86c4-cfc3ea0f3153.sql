-- Add paid_divisions_count column to track how many division slots are paid for
-- Default is 3 (base license includes 3 divisions)
ALTER TABLE tournaments_events 
ADD COLUMN paid_divisions_count INTEGER DEFAULT 3;

-- Update Fall Classic 2025 to have paid_divisions_count = 3 (base license only)
UPDATE tournaments_events 
SET paid_divisions_count = 3 
WHERE id = '15ff0a11-0215-43e5-8aec-73a28c8feed0';