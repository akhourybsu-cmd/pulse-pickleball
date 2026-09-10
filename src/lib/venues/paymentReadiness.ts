import { paymentDraftFrom, validatePaymentDraft } from './paymentDraft';

export interface VenuePaymentSetup {
  mode: 'off' | 'test' | 'live'; ready?: boolean; setup_issues?: string[];
  venue: { id?: string; name: string; verification_approved_at: string | null; stripe_account_id?: string | null; payment_test_sandbox?: boolean };
  account?: { account_id: string; charges_enabled: boolean; payouts_enabled: boolean; card_payments_active?: boolean; details_submitted?: boolean; disabled_reason?: string | null; disconnected_at?: string | null; requirements_due?: string[]; requirements_pending?: string[]; requirements_deadline?: string | null; updated_at?: string } | null;
  settings?: { cancellation_policy?: string; support_email?: string; timezone?: string; tax_inclusive_acknowledged?: boolean; accepting_payments?: boolean } | null;
  courts: { id: string; name: string; hourly_rate: number | null; is_active?: boolean | null }[];
  transferred?: boolean; booking_enabled?: boolean; connect_existing_available?: boolean;
}
export function venuePaymentReadiness(data: VenuePaymentSetup) {
  const testSandbox = data.mode === 'test' && data.venue.payment_test_sandbox === true;
  const connected = !!data.account && data.account.charges_enabled && data.account.payouts_enabled && data.account.card_payments_active === true && !data.account.disabled_reason && !data.account.disconnected_at && !data.transferred;
  const policy = !!data.settings && Object.keys(validatePaymentDraft(paymentDraftFrom(data))).length === 0;
  const pricedCourt = data.courts.some(court => court.is_active !== false && Number(court.hourly_rate) >= 1);
  const steps = [
    { id: 'platform', title: 'PULSE payment service', complete: data.ready === true && data.mode !== 'off', detail: data.mode === 'test' ? 'Sandbox only. No real collections, payouts or bookings.' : data.setup_issues?.join(' ') || (data.ready ? 'The PULSE payment connection is available.' : 'PULSE must finish its Stripe configuration before checkout opens.') },
    { id: 'owner', title: testSandbox ? 'Approved private test venue' : 'Verified venue owner', complete: testSandbox || !!data.venue.verification_approved_at, detail: testSandbox ? 'Only your account can test this private sample. This is not real-business verification and never permits live charges.' : 'Only the verified venue owner can connect the business’s Stripe account.' },
    { id: 'stripe', title: 'Your venue’s Stripe account', complete: connected, detail: data.transferred ? 'Ownership changed. Financial access needs a PULSE review; the previous owner’s account will not be reassigned.' : data.account?.disconnected_at ? 'This account was disconnected from PULSE. Reconnect the same account to continue.' : data.account?.requirements_pending?.length ? 'Stripe is reviewing submitted information. Check again after its review.' : 'Complete business verification and payout details in Stripe. PULSE never collects bank credentials.' },
    { id: 'feature', title: 'Court booking enabled', complete: data.booking_enabled === true, detail: 'Rental checkout requires the court booking feature. Your free community does not require payments.' },
    { id: 'policy', title: 'Saved prices & policy', complete: policy && pricedCourt, detail: 'Save a support email, venue time zone, refund policy, tax acknowledgment and at least one active paid court ($1/hour minimum).' },
  ];
  return { steps, connected, canEnable: data.mode === 'live' && steps.every(step => step.complete), complete: steps.filter(step => step.complete).length };
}

/** Venue identity in an OAuth state is a routing hint only; the server verifies it. */
export function stripeReturnVenue(state: string | null): string | null {
  const candidate = state?.split('.')[0];
  return candidate && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}
