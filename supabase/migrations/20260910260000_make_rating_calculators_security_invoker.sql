-- Rating math does not need database-owner privileges. Keep the existing
-- signatures, grants, and implementations while executing each function with
-- the privileges of its caller.

ALTER FUNCTION public.calculate_pulse_rating_change(
  numeric, numeric, numeric, numeric,
  integer, integer, boolean, text, integer
) SECURITY INVOKER;

ALTER FUNCTION public.calculate_pulse_rating_change(
  numeric, numeric, numeric, numeric,
  integer, integer, boolean, text, integer, numeric
) SECURITY INVOKER;

ALTER FUNCTION public.calculate_rating_change(
  numeric, numeric, numeric, numeric, boolean
) SECURITY INVOKER;

ALTER FUNCTION public.calculate_win_probability(
  numeric, numeric, numeric, numeric
) SECURITY INVOKER;
