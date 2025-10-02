-- Fix security warnings by setting search_path on functions

-- Fix get_week_start function
CREATE OR REPLACE FUNCTION get_week_start(match_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (match_date - (EXTRACT(DOW FROM match_date)::integer + 6) % 7)::date;
$$;

-- Fix set_match_week_start function
CREATE OR REPLACE FUNCTION set_match_week_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.week_start := get_week_start(NEW.match_date);
  RETURN NEW;
END;
$$;