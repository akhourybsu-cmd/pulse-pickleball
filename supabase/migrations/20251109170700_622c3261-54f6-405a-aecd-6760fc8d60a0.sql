-- Add is_test_account column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_test_account BOOLEAN DEFAULT FALSE;

-- Mark existing test accounts based on email pattern
UPDATE public.profiles
SET is_test_account = TRUE
WHERE email LIKE '%@pulsetest.local'
   OR email LIKE 'testaccount%@%'
   OR display_name LIKE 'Test Account%';

-- Create index for faster queries
CREATE INDEX idx_profiles_is_test_account ON public.profiles(is_test_account) WHERE is_test_account = TRUE;

-- Void all existing matches with test accounts BEFORE creating trigger
UPDATE public.matches
SET 
  voided = TRUE,
  voided_by = (SELECT id FROM profiles WHERE email = 'akhourybsu@gmail.com' LIMIT 1),
  voided_at = NOW(),
  void_reason = 'Match includes test accounts'
WHERE id IN (
  SELECT DISTINCT m.id
  FROM matches m
  JOIN match_participants mp ON mp.match_id = m.id
  JOIN profiles p ON p.id = mp.player_id
  WHERE p.is_test_account = TRUE
)
AND voided = FALSE;

-- Now create the validation function
CREATE OR REPLACE FUNCTION public.validate_no_test_accounts_in_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_test_account BOOLEAN;
BEGIN
  -- Skip validation if match is being voided
  IF NEW.voided = TRUE THEN
    RETURN NEW;
  END IF;
  
  -- Check if any participant is a test account
  SELECT EXISTS(
    SELECT 1 
    FROM match_participants mp
    JOIN profiles p ON p.id = mp.player_id
    WHERE mp.match_id = NEW.id
      AND p.is_test_account = TRUE
  ) INTO v_has_test_account;
  
  IF v_has_test_account THEN
    RAISE EXCEPTION 'Cannot create or approve matches with test accounts';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate matches on insert and update
CREATE TRIGGER validate_match_no_test_accounts
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND NEW.voided = FALSE)
  EXECUTE FUNCTION validate_no_test_accounts_in_match();

-- Recalculate ratings after voiding test account matches
SELECT recalculate_all_ratings();