import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueAddonCheckout } from '@/components/venue/VenueAddonCheckout';

const state = vi.hoisted(() => ({
  slots: [] as any[], slot: 0, config: {} as any,
  buttons: [] as { label: string; disabled?: boolean; click?: () => any }[], checkbox: {} as any,
  api: vi.fn(), openStripe: vi.fn(), error: vi.fn(),
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: () => { const index = state.slot++; return [state.slots[index], (next: any) => { state.slots[index] = typeof next === 'function' ? next(state.slots[index]) : next; }]; } };
});
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.config }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children }: any) => <a href={to}>{children}</a> }));
vi.mock('@/lib/payments', () => ({ paymentApi: state.api, openStripe: state.openStripe }));
vi.mock('sonner', () => ({ toast: { error: state.error } }));
vi.mock('@/components/ui/checkbox', () => ({ Checkbox: (props: any) => { state.checkbox = props; return <input type="checkbox" checked={props.checked} disabled={props.disabled} readOnly />; } }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick, disabled, asChild, ...props }: any) => {
  const label = (Array.isArray(children) ? children : [children]).filter(child => typeof child === 'string').join('').trim();
  state.buttons.push({ label, disabled, click: onClick });
  return asChild ? children : <button {...props} disabled={disabled}>{children}</button>;
} }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));
const render = (props: Partial<Parameters<typeof VenueAddonCheckout>[0]> = {}) => {
  state.slot = 0; state.buttons = [];
  return renderToStaticMarkup(<VenueAddonCheckout venueId="venue" venueName="ELEVENO" moduleKey="court_booking" title="Court booking" verified canPurchase {...props} />);
};
const checkout = () => { render(); return state.buttons.find(button => button.label === 'Continue · $10/month')!.click!; };
beforeEach(() => {
  vi.clearAllMocks(); state.slots = [true, true, false, 'same-review-request', null]; state.slot = 0;
  state.config = { data: { mode: 'live', cadence: 'monthly' }, isPending: false, isError: false, refetch: vi.fn() };
});

describe('venue upgrade checkout', () => {
  it('identifies the venue, recurring price, seller, and separate venue rental income', () => {
    const html = render();
    for (const copy of ['For ELEVENO', '$10.00', 'USD / month', 'Sold by PULSE Pickleball', 'Venue rental income is separate', 'automatic renewal until I cancel']) expect(html).toContain(copy);
  });
  it('guards same-tick duplicate clicks and disables agreement/navigation while opening', async () => {
    let finish!: (result: any) => void;
    state.api.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const click = checkout(); const pending = click(); click();
    expect(state.api).toHaveBeenCalledTimes(1);
    expect(state.api).toHaveBeenCalledWith('module_checkout', { venue_id: 'venue', module_key: 'court_booking', cadence: 'monthly', accept_terms: true, request_key: 'same-review-request' });
    const html = render(); expect(state.checkbox.disabled).toBe(true);
    expect(html).toContain('Opening secure checkout'); expect(html).not.toContain('Manage existing purchases');
    finish({ url: 'https://checkout.stripe.com/example' }); await pending;
    expect(state.openStripe).toHaveBeenCalledOnce();
  });
  it('shows an inline failure for missing checkout data and reuses the request key on retry', async () => {
    state.api.mockResolvedValueOnce({}).mockResolvedValueOnce({ url: 'https://checkout.stripe.com/example' });
    await checkout()();
    const html = render(); expect(html).toContain('role="alert"'); expect(html).toContain('no purchase has been confirmed here');
    expect(state.openStripe).not.toHaveBeenCalled();
    await checkout()();
    expect(state.api.mock.calls[0][1].request_key).toBe(state.api.mock.calls[1][1].request_key);
    expect(state.openStripe).toHaveBeenCalledOnce();
  });
  it('does not call checkout without owner authority, verification, consent, or payment availability', async () => {
    const attempts = [{ canPurchase: false }, { verified: false }, {}];
    for (const props of attempts) {
      if (!Object.keys(props).length) state.slots[1] = false;
      render(props); await state.buttons.find(button => button.click && !button.label.startsWith('Review'))!.click!();
    }
    state.slots[1] = true; state.config.isError = true; render();
    await state.buttons.find(button => button.label === 'Checkout unavailable')!.click!();
    expect(state.api).not.toHaveBeenCalled();
  });
});
