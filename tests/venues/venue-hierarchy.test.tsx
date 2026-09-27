import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { groupedVenueHours } from '@/lib/venues/hours';
import { parseVenueDay, venueDayKey, venueDayOptions, venueTabParams } from '@/lib/venues/navigation';
import { filterVenueOccasions, VENUE_OCCASION_FORMATS, type VenueOccasion } from '@/lib/venues/events';
import { VenueEventsPage, VenuePageHeading, VenuePlayCategories } from '@/components/venue/VenuePlayerPages';
import { VenueClubAbout, VenueClubCommunityNav } from '@/components/venue/VenueClubHome';
import { DayStrip } from '@/components/venue/DayStrip';

const noop = vi.fn();
const events: VenueOccasion[] = [
  { id: 'league', leagueId: 'l', title: 'Doubles league', kind: 'leagues', description: null, start: null, end: null },
  { id: 'social', programId: 's', title: 'Social night', kind: 'social', description: null, start: '2099-10-10T18:00:00Z', end: null },
  { id: 'competition', programId: 'c', title: 'Round robin', kind: 'competition', description: null, start: '2099-10-09T18:00:00Z', end: null },
];

describe('venue hierarchy and return context', () => {
  it('groups consecutive identical hours, retaining closed and unknown days', () => {
    const days = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, { open: '06:00', close: '22:00' }]));
    expect(groupedVenueHours({ days })).toHaveLength(1);
    expect(groupedVenueHours({ days })[0].days).toBe('Mon–Sun');
    expect(groupedVenueHours({ days: { ...days, 0: null, 6: { open: '08:00', close: '20:00' } } }).map(row => row.days)).toEqual(['Mon–Fri', 'Sat', 'Sun']);
    expect(groupedVenueHours({ days: { 1: null } })).toEqual([{ days: 'Mon', hours: 'Closed' }, { days: 'Tue–Sun', hours: 'Not listed' }]);
    expect(groupedVenueHours(null)).toEqual([]);
  });
  it('shows only supplied amenities and safe contact destinations', () => {
    const html = renderToStaticMarkup(<VenueClubAbout name="Club" amenities={['Indoor courts', 'Parking']} websiteUrl="https://club.example" />);
    expect(html).toContain('Indoor courts'); expect(html).toContain('Parking');
    expect(html).not.toContain('Pro shop'); expect(html).toContain('https://club.example');
  });
  it('retains selected day and community section across tab and return URLs', () => {
    const original = new URLSearchParams('tab=feed&section=players&day=2026-09-29&playCategory=clinic');
    const home = venueTabParams(original, 'home');
    expect(home.get('day')).toBe('2026-09-29');
    expect(venueTabParams(home, 'feed').get('section')).toBe('players');
    expect(venueTabParams(home, 'play').get('playCategory')).toBe('clinic');
    expect(original.get('tab')).toBe('feed');
  });
  it('rejects invalid dates and includes a calendar jump beyond the two-week strip', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-09-29T00:00Z', 'invalid']) expect(parseVenueDay(bad)).toBeNull();
    const chosen = parseVenueDay('2026-10-25')!;
    const options = venueDayOptions(chosen, new Date(2026, 8, 27));
    expect(options).toHaveLength(14); expect(venueDayKey(options[0])).toBe('2026-10-25');
    expect(venueDayKey(parseVenueDay('2028-02-29')!)).toBe('2028-02-29');
    const html = renderToStaticMarkup(<DayStrip value={chosen} onChange={noop} />);
    expect(html).toContain('Jump to date'); expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('October 25, 2026');
  });
  it('separates occasions from daily play and preserves meaningful event categories', () => {
    expect(VENUE_OCCASION_FORMATS).not.toContain('open_play');
    expect(VENUE_OCCASION_FORMATS).not.toContain('clinic');
    expect(filterVenueOccasions(events, 'upcoming').map(row => row.id)).toEqual(['competition', 'social', 'league']);
    expect(filterVenueOccasions(events, 'leagues').map(row => row.id)).toEqual(['league']);
    const html = renderToStaticMarkup(<VenueEventsPage name="Club" events={events} filter="social" onFilter={noop} onRetry={noop} onProgram={noop} onLeague={noop} />);
    expect(html).toContain('Social night'); expect(html).not.toContain('Doubles league');
    expect(html).not.toContain('Choose a day'); expect(html).not.toContain('New program');
    expect(html).not.toContain('Add venue program');
    expect(renderToStaticMarkup(<VenuePageHeading title="Play" onAdd={noop} />)).toContain('Add venue program');
  });
  it('nests court reservations and leagues under Play and identifies the active Community section', () => {
    const html = renderToStaticMarkup(<VenuePlayCategories category="book" hasBooking onChange={noop} onBook={noop} onLeagues={noop} />);
    expect(html).toContain('Court Reservations'); expect(html).toContain('Leagues');
    const without = renderToStaticMarkup(<VenuePlayCategories category="open_play" hasBooking={false} onChange={noop} onBook={noop} onLeagues={noop} />);
    expect(without).not.toContain('Court Reservations');
    const community = renderToStaticMarkup(<VenueClubCommunityNav section="chat" onPosts={noop} onMembers={noop} onChat={noop} />);
    expect(community).toContain('>Feed<'); expect(community).toContain('aria-pressed="true" class="club-community-button">Chat');
  });
});
