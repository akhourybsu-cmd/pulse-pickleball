import palaceLogo from '../../../src/assets/pickleball-palace-logo.png';
const params = new URLSearchParams(window.location.search);
const config = { mode: 'test', livemode: false, cadence: 'monthly', ready: true };
export const useAuthState = () => ({ user: { id: 'sample-owner' } });
export const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const openStripe = () => { throw new Error('External checkout is blocked in this local preview.'); };
export const supabase = {
  from: (table: string) => {
    if (table !== 'venues') throw new Error('Backend access is blocked in this local preview.');
    return { select: () => ({ eq: () => ({ single: async () => ({ data: { name: 'Pickleball Palace', primary_color: '#c9962f', secondary_color: '#183936', logo_url: palaceLogo, logo_shape: 'circle', logo_image_fit: 'contain' }, error: null }) }) }) };
  },
};
export async function paymentApi(action: string, values: Record<string, any> = {}) {
  if (action === 'config' || action === 'status') return config;
  if (action === 'booking_details') {
    if (params.has('loading')) return new Promise(() => {});
    if (params.has('price-error')) throw new Error('Local price verification failure.');
    return { ...config, paid: !params.has('free'), hourly_rate: 10 };
  }
  if (action === 'quote') return { ...config, amount_cents: Math.round((new Date(values.end_time).getTime() - new Date(values.start_time).getTime()) / 3600), hourly_rate: 10, merchant_name: 'Pickleball Palace', policy: 'Fictional test venue only. No real reservations or money. ThisLongUnbrokenPolicyWordChecksNarrowScreenWrappingWithoutClipping.', support_email: 'palace-sandbox@example.com', timezone: 'America/New_York' };
  if (action === 'cancellations') return { requests: [] };
  if (action === 'venue') return { ...config, venue: { name: 'Pickleball Palace', verification_approved_at: null, payment_test_sandbox: true }, account: { account_id: 'acct_local_sample', charges_enabled: false, payouts_enabled: false, card_payments_active: false, requirements_due: ['business_profile.url', 'external_account'], requirements_pending: ['individual.verification.document'] }, courts: [{ id: 'c1', name: 'ChampionshipCourtWithAVeryLongUnbrokenName', hourly_rate: 10, is_active: true }], booking_enabled: true, settings: { cancellation_policy: 'Test venue. No real bookings or money.', support_email: 'palace-sandbox@example.com', timezone: 'America/New_York', tax_inclusive_acknowledged: true, accepting_payments: false } };
  throw new Error('Mutations are blocked in this local preview.');
}
