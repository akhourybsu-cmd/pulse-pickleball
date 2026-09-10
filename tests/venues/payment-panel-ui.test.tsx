import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenuePaymentsPanel } from '@/components/venue/VenuePaymentsPanel';
import { emptyPaymentDraft, paymentDraftFrom, paymentDraftReducer } from '@/lib/venues/paymentDraft';

const state = vi.hoisted(() => ({
  data: {} as any,
  requests: { data: { requests: [] }, isPending: false, isError: false, isFetching: false } as any,
  draft: null as any,
  buttons: [] as { label: string; disabled?: boolean; click?: () => unknown }[],
  keys: [] as unknown[][],
  api: vi.fn(), success: vi.fn(), error: vi.fn(), refetch: vi.fn(),
}));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/components/venue/VenueStripeReturn', () => ({ VenueStripeReturn: () => null }));
vi.mock('@/components/venue/VenueAddonCheckout', () => ({ VenueAddonCheckout: () => <div>Test subscription checkout</div> }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children }: any) => <a href={to}>{children}</a> }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (query: { queryKey: unknown[] }) => {
    state.keys.push(query.queryKey);
    return query.queryKey[0] === 'venue-payments' ? { data: state.data, isPending: false, isError: false, refetch: state.refetch } : { ...state.requests, refetch: state.refetch };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const { paymentDraftReducer } = await import('@/lib/venues/paymentDraft');
  return { ...actual, useReducer: (reducer: any, ...args: any[]) => reducer === paymentDraftReducer ? [state.draft, vi.fn()] : (actual.useReducer as any)(reducer, ...args) };
});
vi.mock('@/components/ui/button', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/ui/button')>();
  const { Children, createElement } = await import('react');
  return { ...actual, Button: (props: any) => {
    state.buttons.push({ label: Children.toArray(props.children).filter(child => typeof child === 'string').join('').trim(), disabled: props.disabled, click: props.onClick });
    return createElement(actual.Button, props);
  } };
});
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error, warning: vi.fn() } }));
vi.mock('@/lib/payments', () => ({ paymentApi: state.api, openStripe: vi.fn(), formatMoney: (cents: number) => `$${(cents / 100).toFixed(2)}` }));

const render = () => renderToStaticMarkup(<VenuePaymentsPanel venueId="venue" />);
beforeEach(() => {
  vi.clearAllMocks(); state.buttons = []; state.keys = [];
  state.data = { mode: 'live', venue: { name: 'Pickleball Palace', verification_approved_at: '2026-09-09' }, courts: [{ id: 'c1', name: 'Championship court with a long name', hourly_rate: 25, is_active: false }], account: { charges_enabled: true, payouts_enabled: true }, settings: { cancellation_policy: 'Cancel at least 24 hours before your reservation for a full refund.', support_email: 'support@palace.example', timezone: 'America/New_York', tax_inclusive_acknowledged: true, accepting_payments: false } };
  state.requests = { data: { requests: [] }, isPending: false, isError: false, isFetching: false };
  state.data.ready = true; state.data.booking_enabled = true; state.data.account.card_payments_active = true; state.data.account.account_id = 'acct_venue';
  state.draft = paymentDraftReducer(emptyPaymentDraft, { type: 'receive', scope: 'venue:viewer', value: paymentDraftFrom(state.data) });
  state.refetch.mockResolvedValue({ isError: false });
});
const request = (status = 'requested') => ({ id: 'r1', order_id: 'order', note: 'I cannot attend.', status, payment_orders: { description: 'Court rental', amount_cents: 5000, refunded_cents: 1000 } });

describe('venue payment presentation', () => {
  it('opens Stripe setup for approved private testing without claiming business verification', () => {
    state.data.mode = 'test'; state.data.venue.verification_approved_at = null; state.data.venue.payment_test_sandbox = true;
    const html = render();
    expect(html).toContain('Private Stripe sandbox'); expect(html).toContain('Test PULSE feature subscriptions');
    expect(html).toContain('Live collections are permanently disabled');
    expect(html).not.toContain('Complete venue ownership verification before connecting');
    expect(state.buttons.find(button => button.label === 'Review Stripe setup')?.disabled).toBe(false);
    state.data.mode = 'live'; state.buttons = [];
    expect(render()).not.toContain('Private Stripe sandbox');
    expect(state.buttons.find(button => button.label === 'Review Stripe setup')?.disabled).toBe(true);
  });
  it('scopes private settings and request caches to the viewer', () => {
    const html = render();
    expect(state.keys).toEqual([['venue-payments', 'venue', 'viewer'], ['venue-payment-requests', 'venue', 'viewer']]);
    expect(html).toContain('Inactive · not bookable');
    expect(state.buttons.find(button => button.label === 'Save prices & policy')?.disabled).toBe(true);
  });
  it('distinguishes request loading, disabled payments, errors and empty results', () => {
    state.requests.isPending = true;
    expect(render()).toContain('Loading payment requests'); expect(render()).not.toContain('No open payment requests');
    state.data.mode = 'off'; expect(render()).toContain('when payments are available');
    state.data.mode = 'live'; state.requests.isPending = false; state.requests.isError = true;
    expect(render()).toContain('Couldn’t load requests');
    state.requests.isError = false; expect(render()).toContain('No open payment requests');
  });
  it('shows remaining refundable money and protects requests missing order details', () => {
    state.requests.data.requests = [request(), { id: 'missing', payment_orders: null }];
    const html = render(); expect(html).toContain('$40.00 remaining'); expect(html).toContain('Payment details are unavailable');
    expect(html).toContain('at least 5 characters');
  });
  it('only offers retrying the refund after a refund has already started', () => {
    state.requests.data.requests = [request('refund_pending')];
    const html = render();
    expect(html).toContain('Retry pending refund');
    expect(html).not.toContain('Cancel without refund'); expect(html).not.toContain('Decline request');
  });
  it('keeps the draft visible and blocks leaving for Stripe or overwriting a detected conflict', () => {
    state.draft = paymentDraftReducer(state.draft, { type: 'edit', patch: { policy: 'This is my unsaved cancellation policy.' } });
    state.draft = paymentDraftReducer(state.draft, { type: 'receive', scope: 'venue:viewer', value: { ...paymentDraftFrom(state.data), accepting: true } });
    const html = render();
    expect(html).toContain('This is my unsaved cancellation policy.'); expect(html).toContain('Saved settings changed elsewhere');
    expect(state.buttons.find(button => button.label === 'Review Stripe setup')?.disabled).toBe(true);
    expect(state.buttons.find(button => button.label === 'Save prices & policy')?.disabled).toBe(true);
  });
});

describe('payment action confirmation', () => {
  const prepareSave = () => {
    state.draft = paymentDraftReducer(state.draft, { type: 'edit', patch: { prices: { c1: '30.00' } } });
    render(); return state.buttons.find(button => button.label === 'Save prices & policy')!.click!;
  };
  it('does not call the API for invalid settings', () => {
    state.draft = paymentDraftReducer(state.draft, { type: 'edit', patch: { email: 'invalid' } });
    prepareSave()();
    expect(state.api).not.toHaveBeenCalled(); expect(state.error).toHaveBeenCalled();
  });
  it('does not claim an unconfirmed update succeeded', async () => {
    state.api.mockResolvedValue({ saved: false }); prepareSave()();
    await vi.waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(state.success).not.toHaveBeenCalled(); expect(state.refetch).not.toHaveBeenCalled();
  });
  it('guards double clicks and refreshes only after a confirmed update', async () => {
    let finish!: (result: unknown) => void;
    state.api.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const click = prepareSave(); click(); click();
    expect(state.api).toHaveBeenCalledTimes(1);
    expect(state.api).toHaveBeenCalledWith('save_venue', expect.objectContaining({ venue_id: 'venue', rates: [{ id: 'c1', price: '30.00' }], accepting_payments: false }));
    finish({ saved: true });
    await vi.waitFor(() => expect(state.success).toHaveBeenCalledWith('Prices and policy saved'));
    expect(state.refetch).toHaveBeenCalled();
  });
});
