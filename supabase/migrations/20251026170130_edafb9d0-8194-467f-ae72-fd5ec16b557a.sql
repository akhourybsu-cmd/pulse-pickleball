-- Update lfg_posts table to remove skill range and add title
ALTER TABLE lfg_posts
DROP COLUMN IF EXISTS skill_min,
DROP COLUMN IF EXISTS skill_max,
ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Looking for Game',
ADD COLUMN IF NOT EXISTS intensity text NOT NULL DEFAULT 'casual';

-- Update existing records to have a default title if needed
UPDATE lfg_posts 
SET title = 'Looking for Game' 
WHERE title IS NULL OR title = '';