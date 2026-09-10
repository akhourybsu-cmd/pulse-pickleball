-- Owner-approved, private Stripe TEST permission for Pickleball Palace only.
-- Run AFTER 20260921110000_private_venue_test_payments.sql. Idempotent.
-- Does not connect an account, enable real charges, change prices, remove
-- included features, or change any visibility / membership / verification.
BEGIN;
DO $$
BEGIN
  PERFORM 1 FROM public.private_venue_sandboxes s
    JOIN public.venues v ON v.id=s.venue_id
    JOIN public.groups g ON g.id=s.group_id
    JOIN auth.users u ON u.id=s.owner_id
  WHERE s.venue_id='df0b7022-06eb-4bc4-b04c-eabd99ae76c1'
    AND s.group_id='b7508c4d-5d37-4dd8-a623-019fa49d50cf'
    AND s.owner_id='fff594fe-02ea-439c-a974-72e1f6295f08'
    AND v.owner_id=s.owner_id AND g.created_by=s.owner_id
    AND lower(u.email)='akhourybsu@gmail.com' AND u.email_confirmed_at IS NOT NULL
    AND v.is_published=false AND v.is_searchable=false
    AND v.verification_approved_at IS NULL AND g.visibility='private'
  FOR UPDATE OF s,v;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected private Palace and confirmed owner do not match. No changes made.'; END IF;
  UPDATE public.private_venue_sandboxes SET test_payments_enabled=true
    WHERE venue_id='df0b7022-06eb-4bc4-b04c-eabd99ae76c1';
END $$;
COMMIT;

SELECT s.venue_id,s.test_payments_enabled,v.name,v.is_published,v.is_searchable,
  v.verification_approved_at,
  public.payment_venue_owner_eligible(v.id,v.owner_id,false) AS test_allowed,
  public.payment_venue_owner_eligible(v.id,v.owner_id,true) AS live_allowed
FROM public.private_venue_sandboxes s JOIN public.venues v ON v.id=s.venue_id
WHERE s.venue_id='df0b7022-06eb-4bc4-b04c-eabd99ae76c1';
