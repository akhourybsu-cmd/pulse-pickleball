-- Add display_order column to group_members for custom ordering
ALTER TABLE public.group_members 
ADD COLUMN display_order integer DEFAULT 0;