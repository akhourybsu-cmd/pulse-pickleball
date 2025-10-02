-- Fix security warnings by adding search_path to functions

-- Update get_week_start function with search_path
CREATE OR REPLACE FUNCTION get_week_start(match_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (match_date - (EXTRACT(DOW FROM match_date)::integer + 6) % 7)::date;
$$;

-- Update set_match_week_start function with search_path
CREATE OR REPLACE FUNCTION set_match_week_start()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.week_start := get_week_start(NEW.match_date);
  RETURN NEW;
END;
$$;