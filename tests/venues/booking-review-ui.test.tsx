import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookCourtDialog } from '@/components/venue/BookCourtDialog';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
import { bookingDurationOptions } from '@/lib/venues/experience';
import type { CourtColumn } from '@/lib/venues/availability';

const state = vi.hoisted(() => ({
  details: {} as any, quote: {} as any, mobile: true, selection: null as any,
  buttons: [] as any[], queries: [] as any[], selects: [] as any[],
  api: vi.fn(), insert: vi.fn(), openStripe: vi.fn(),
}));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => state.mobile }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: any) => state.selection && initial === null ? [state.selection, vi.fn()] : actual.useState(initial) };
});
vi.mock('@/components/venue/DayStrip', () => ({ DayStrip: ({ trailing }: any) => <div>{trailing}</div> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: vi.fn() }, from: () => ({ insert: state.insert }) } }));
vi.mock('@/lib/payments', () => ({ paymentApi: state.api, openStripe: state.openStripe, formatMoney: (cents: number) => `$${(cents / 100).toFixed(2)}` }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => { state.queries.push(options); return options.queryKey[0] === 'court-quote' ? state.quote : state.details; } }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children, ...props }: any) => <div role="dialog" {...props}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: (props: any) => { state.selects.push(props); return <button disabled={props.disabled} aria-label="Duration" />; },
  SelectValue: () => null, SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <span data-duration={value}>{children}</span>,
}));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick, ...props }: any) => {
  state.buttons.push({ children, click: onClick, ...props });
  return <button {...props}>{children}</button>;
} }));

const start = new Date('2099-09-15T14:00:00Z');
const end = new Date('2099-09-15T18:00:00Z');
const court = { id: 'court', name: 'Court 6', court_number: 6, is_active: true };
const props = { open: true, onOpenChange: vi.fn(), onBooked: vi.fn(), groupId: 'group', venueId: 'venue', court, start, dayEnd: end, slotMinutes: 60, timeZone: 'America/New_York' };
const render = (patch = {}) => { state.buttons = []; state.queries = []; state.selects = []; return renderToStaticMarkup(<BookCourtDialog {...props} {...patch} />); };
const submit = () => state.buttons.at(-1)!;
beforeEach(() => {
  vi.clearAllMocks(); state.mobile = true; state.selection = null;
  state.details = { data: { paid: false, mode: 'test' }, isPending: false, isFetching: false, isError: false };
  state.quote = { data: { amount_cents: 1000, hourly_rate: 10, merchant_name: 'Pickleball Palace', policy: 'Test cancellation policy.', support_email: 'sandbox@example.com', timezone: 'America/New_York' }, isPending: false, isFetching: false, isError: false };
});
describe('court booking review', () => {
  it('never claims free booking before the price is verified', async () => {
    state.details = { isPending: true, isFetching: true };
    const html = render(); expect(html).toContain('Checking price'); expect(html).not.toContain('Book free court');
    expect(submit().disabled).toBe(true); await submit().click();
    expect(state.insert).not.toHaveBeenCalled(); expect(state.api).not.toHaveBeenCalled();
  });
  it('does not expose a stale free price while refreshing or after a failure', async () => {
    for (const patch of [{ isFetching: true }, { isError: true }]) {
      Object.assign(state.details, patch); const html = render();
      expect(html).not.toContain('Book free court'); expect(submit().disabled).toBe(true);
      await submit().click();
    }
    expect(state.api).not.toHaveBeenCalled(); expect(state.insert).not.toHaveBeenCalled();
  });
  it('identifies genuinely free reservations and shows their optional name', () => {
    const html = render(); expect(html).toContain('Free reservation'); expect(html).toContain('Booking name (optional)');
    expect(html).toContain('Book free court'); expect(submit().disabled).toBe(false);
  });
  it('rejects a malformed price response instead of treating it as free', async () => {
    state.details.data = {};
    const html = render(); expect(html).toContain('Price unavailable'); expect(html).not.toContain('Free reservation');
    expect(submit().disabled).toBe(true); await submit().click();
    expect(state.api).not.toHaveBeenCalled(); expect(state.insert).not.toHaveBeenCalled();
  });
  it('uses neutral text during quote refresh, never a stale payment total', () => {
    state.details.data.paid = true; state.quote.isFetching = true;
    expect(render()).toContain('Checking total'); expect(submit().disabled).toBe(true);
  });
  it('clearly separates a sample payment from a real reservation', async () => {
    state.details.data.paid = true;
    const html = render(); expect(html).toContain('Test checkout only'); expect(html).toContain('Test payment · $10.00');
    expect(html).toContain('no real court reservation'); expect(html).not.toContain('Pay $10.00 &amp; reserve');
    expect(html).not.toContain('Booking name (optional)');
    expect(submit().disabled).toBe(true); await submit().click();
    expect(state.api).not.toHaveBeenCalled(); expect(state.insert).not.toHaveBeenCalled();
  });
  it('requires explicit policy consent for a live rental too', async () => {
    state.details.data = { paid: true, mode: 'live' };
    expect(render()).toContain('Pay $10.00 &amp; reserve'); expect(submit().disabled).toBe(true);
    await submit().click(); expect(state.api).not.toHaveBeenCalled(); expect(state.insert).not.toHaveBeenCalled();
  });
  it.each([45, 270])('allows recovery from an invalid preselected paid duration of %i minutes', async minutes => {
    state.details.data.paid = true;
    const html = render({ presetMinutes: minutes, dayEnd: new Date('2099-09-15T20:00:00Z') });
    expect(html).toContain('Choose an available duration'); expect(state.selects[0].disabled).toBe(false);
    expect(state.queries.find(q => q.queryKey[0] === 'court-quote').enabled).toBe(false);
    expect(submit().disabled).toBe(true); await submit().click(); expect(state.api).not.toHaveBeenCalled();
  });
  it('offers every valid paid half-hour up to four hours, bounded by availability', () => {
    expect(bookingDurationOptions(45, 300, true)).toEqual([30, 60, 90, 120, 150, 180, 210, 240]);
    expect(bookingDurationOptions(60, 100, true)).toEqual([30, 60, 90]);
    expect(bookingDurationOptions(60, 300, false, 240)).toContain(240);
  });
  it('does not quote or submit past closing time or on an inactive court', async () => {
    state.details.data.paid = true;
    for (const patch of [{ presetMinutes: 300 }, { court: { ...court, is_active: false } }]) {
      render(patch); expect(submit().disabled).toBe(true); await submit().click();
      expect(state.queries.find(q => q.queryKey[0] === 'court-quote').enabled).toBe(false);
    }
    expect(state.api).not.toHaveBeenCalled();
  });
});

const grid: CourtColumn[] = [{ court, slots: [{ start, end: new Date(start.getTime() + 3600_000), reservation: null, bookable: true }] }];
const renderGrid = (patch = {}) => renderToStaticMarkup(<VenueBookingGrid grid={grid} day={start} loading={false} canBook timeZone="America/New_York" onDayChange={vi.fn()} onPickSlot={vi.fn()} {...patch} />);
describe('court calendar interaction labels', () => {
  it('gives the selected court readable space with a full-width mobile review action', () => {
    state.selection = { courtId: court.id, from: 0, to: 0 };
    const html = renderGrid();
    expect(html).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(html).toContain('col-span-2 min-h-11 w-full');
    expect(html).toContain('Review booking');
  });
  it('names the court and venue-local time, while explaining selection is not a hold', () => {
    const html = renderGrid(); expect(html).toMatch(/aria-label="Select Court 6[^"\n]*10:00 AM–11:00 AM · venue time"/);
    expect(html).toContain('Selecting a time does not hold the court'); expect(html).toContain('min-h-11 min-w-11 max-w-full');
  });
  it('names desktop slots and exposes keyboard focus and horizontal scrolling', () => {
    state.mobile = false; const html = renderGrid();
    expect(html).toContain('Review booking · Court 6'); expect(html).toContain('scroll horizontally for more courts');
    expect(html).toContain('group-focus-visible:opacity-100');
  });
  it('keeps occupied staff actions labeled without making holds editable', () => {
    state.mobile = false;
    const occupied = [{ court, slots: [{ ...grid[0].slots[0], bookable: false, reservation: { id: 'session', venue_court_id: court.id, start_time: start.toISOString(), end_time: end.toISOString(), title: 'Social doubles' } }] }];
    const html = renderGrid({ grid: occupied, onPickSession: vi.fn() });
    expect(html).toContain('aria-label="Social doubles · Court 6');
    occupied[0].slots[0].reservation.id = 'hold:test';
    expect(renderGrid({ grid: occupied, onPickSession: vi.fn() })).not.toContain('type="button" style="grid-column:2');
  });
});
