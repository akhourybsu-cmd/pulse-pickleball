import { describe, expect, it } from 'vitest';
import { programDateLabel, programFilterState, programPhase, venueWebsiteLink, withConfirmedProgramRsvp } from '@/lib/venues/programExperience';
import type { GroupEvent } from '@/hooks/useGroupEvents';

describe('program browsing', () => {
  const session = (format: string, hour = 18) => ({ event_format: format, start_time: new Date(2026, 8, 14, hour).toISOString() });
  it('falls back to All when a different day has no sessions for the old filter', () => {
    expect(programFilterState([session('clinic')], 'clinic').active).toBe('clinic');
    const nextDay = programFilterState([session('open_play')], 'clinic');
    expect(nextDay.active).toBe('all');
    expect(nextDay.shown).toHaveLength(1);
  });
  it('groups practices with clinics and sorts by start time without mutating input', () => {
    const sessions = [session('practice', 20), session('social'), session('clinic', 17)];
    expect(programFilterState(sessions, 'clinic').shown).toEqual([sessions[2], sessions[0]]);
    expect(sessions[0].event_format).toBe('practice');
  });
  it('handles an empty day', () => expect(programFilterState([], 'social')).toMatchObject({ active: 'all', shown: [] }));
  it('uses the actual end time, including overnight programs', () => {
    const event = { start_time: new Date(2026, 8, 14, 23).toISOString(), end_time: new Date(2026, 8, 15, 1).toISOString() };
    expect(programPhase(event, new Date(2026, 8, 14, 22))).toBe('upcoming');
    expect(programPhase(event, new Date(2026, 8, 15, 0))).toBe('live');
    expect(programPhase(event, new Date(2026, 8, 15, 1))).toBe('ended');
  });
  it('closes past programs without an end time and fails closed for invalid timestamps', () => {
    expect(programPhase(session('clinic'), new Date(2026, 8, 14, 19))).toBe('ended');
    expect(programPhase({ start_time: 'invalid' })).toBe('ended');
  });
  it('shows Today and Tomorrow using local calendar dates across a month boundary', () => {
    const now = new Date(2026, 8, 30, 23);
    expect(programDateLabel(now.toISOString(), now)).toBe('Today');
    expect(programDateLabel(new Date(2026, 9, 1, 9).toISOString(), now)).toBe('Tomorrow');
    expect(programDateLabel('invalid', now)).toBe('Date unavailable');
  });
});

describe('confirmed registration feedback', () => {
  const event = { user_rsvp: 'going', rsvps: { going: 8, waitlist: 2, maybe: 1, not_going: 0 } } as GroupEvent;
  it('updates both counts when the server confirms a change', () => {
    expect(withConfirmedProgramRsvp(event, 'maybe')).toMatchObject({ user_rsvp: 'maybe', rsvps: { going: 7, maybe: 2 } });
    expect(event.rsvps?.going).toBe(8);
  });
  it('uses waitlist when that is what the server confirms', () => {
    expect(withConfirmedProgramRsvp({ ...event, user_rsvp: null }, 'waitlist').rsvps).toMatchObject({ going: 8, waitlist: 3 });
  });
  it('does not double count repeated confirmations or produce negative counts', () => {
    expect(withConfirmedProgramRsvp(event, 'going')).toBe(event);
    expect(withConfirmedProgramRsvp({ ...event, rsvps: undefined }, 'maybe').rsvps).toMatchObject({ going: 0, maybe: 1 });
  });
});

describe('venue website links', () => {
  it('accepts a bare hostname and normalizes it to HTTPS', () => expect(venueWebsiteLink(' palace.example/contact ')).toBe('https://palace.example/contact'));
  it.each(['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com', 'not a website', '', null])('rejects unsafe or malformed link %s', value => expect(venueWebsiteLink(value)).toBeNull());
});
