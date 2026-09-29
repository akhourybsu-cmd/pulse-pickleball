import { buildDayGrid } from '@/lib/venues/availability';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VenueHoursEditor } from '@/components/community/admin/VenueHoursSection';
import { VenueBookingGrid } from '@/components/venue/VenueBookingGrid';
import { CourtStatusBoard } from '@/components/venue/ops/CourtStatusBoard';
import { OpsStatRail } from '@/components/venue/ops/OpsStatRail';
import { defaultVenueHours } from '@/lib/venues/hours';
import { courtStatuses, daySummary } from '@/lib/venues/ops';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const now = new Date(2026, 8, 15, 9);
const court = { id: 'c1', name: 'Championship court', court_number: 1, is_active: true };
const hold = { id: 'hold:1', title: 'Checkout in progress', venue_court_id: 'c1', event_format: 'checkout_hold', start_time: new Date(2026, 8, 15, 8).toISOString(), end_time: new Date(2026, 8, 15, 10).toISOString() };

describe('venue management presentation', () => {
  it('keeps midnight editable and explains its meaning', () => {
    const hours = defaultVenueHours(); hours.days[1] = { openMinutes: 450, closeMinutes: 1440 };
    const html = renderToStaticMarkup(<VenueHoursEditor hours={hours} setHours={() => {}} setDay={() => {}} saving={false} error={null} onCopy={() => {}} onSave={() => {}} />);
    expect(html).toContain('value="00:00"');
    expect(html).not.toContain('value="24:00"');
    expect(html).toContain('Midnight · end of day');
    expect(html).toContain('Existing reservations stay unchanged');
  });
  it('shows a failed save inline without replacing the draft', () => {
    const html = renderToStaticMarkup(<VenueHoursEditor hours={defaultVenueHours()} setHours={() => {}} setDay={() => {}} saving={false} error="Connection lost" onCopy={() => {}} onSave={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Connection lost');
    expect(html).toContain('value="06:00"');
  });
  it('keeps date navigation on a closed day without a misleading missing-courts message', () => {
    const html = renderToStaticMarkup(<VenueBookingGrid grid={[]} day={now} loading={false} closed canBook onDayChange={() => {}} onPickSlot={() => {}} />);
    expect(html).toContain('Choose a day');
    expect(html).toContain('Closed on this day');
    expect(html).not.toContain('No active courts');
  });
  it('does not call disabled or unavailable inventory a missing venue setup', () => {
    const html = renderToStaticMarkup(<VenueBookingGrid grid={[]} day={now} loading={false} canBook={false} onDayChange={() => {}} onPickSlot={() => {}} />);
    expect(html).toContain('No active courts available');
    expect(html).not.toContain('No courts yet');
    expect(html).not.toContain('Only staff');
  });
  it('distinguishes checkout holds from confirmed play', () => {
    const statuses = courtStatuses([court], [hold], now);
    const html = renderToStaticMarkup(<CourtStatusBoard statuses={statuses} onPickCourt={() => {}} />);
    expect(html).toContain('Held');
    expect(html).toContain('Awaiting payment confirmation');
    expect(html).not.toContain('Free rest of day');
  });
  it('labels capacity in blocks, includes holds, and hides live counts for future dates', () => {
    const summary = daySummary([], courtStatuses([court], [hold], now), now);
    const live = renderToStaticMarkup(<OpsStatRail summary={summary} />);
    expect(live).toContain('booking blocks');
    expect(live).not.toContain('court-hours');
    expect(live).toContain('1 held');
    const future = renderToStaticMarkup(<OpsStatRail summary={summary} showLive={false} />);
    expect(future).not.toContain('in play');
    expect(future).toContain('No bookable blocks remaining');
  });
});

it('labels an allocated event with its exact times inside larger calendar slots', () => {
  const day = new Date(2026,8,28);
  const grid = buildDayGrid([court],[{id:'event-hold',title:'Skills clinic',venue_court_id:'c1',event_format:'program_hold',start_time:'2026-09-28T21:30:00Z',end_time:'2026-09-28T22:45:00Z'}],day,{openHour:16,closeHour:20,slotMinutes:60,timeZone:'America/New_York',now:new Date('2026-09-28T18:00Z')});
  const html = renderToStaticMarkup(<VenueBookingGrid grid={grid} day={day} timeZone="America/New_York" loading={false} canBook onDayChange={()=>{}} onPickSlot={()=>{}} onPickSession={()=>{}} />);
  expect(html).toContain('5:30 PM–6:45 PM');
  expect(html).not.toContain('Skills clinic · Championship court · Monday, Sep 28, 5:00 PM–7:00 PM');
});
