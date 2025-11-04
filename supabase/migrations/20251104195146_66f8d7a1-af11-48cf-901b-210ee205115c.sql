-- Add box_number column to queue_entries for the new box system
ALTER TABLE queue_entries 
ADD COLUMN box_number integer;

-- Add index for better performance when querying by box
CREATE INDEX idx_queue_entries_box ON queue_entries(session_id, box_number);