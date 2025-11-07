-- Add start_time field to round_robin_events
ALTER TABLE round_robin_events 
ADD COLUMN start_time time without time zone DEFAULT '09:00:00';

-- Update the existing event to have 9 AM start time
UPDATE round_robin_events 
SET start_time = '09:00:00' 
WHERE id = '47e70d29-f711-4d20-8d3b-251af947d738';