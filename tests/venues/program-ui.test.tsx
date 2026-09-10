import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VenueHome } from '@/components/venue/VenueHome';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { VenueProgramDialog } from '@/components/venue/VenueProgramDialog';
import { defaultVenueHours } from '@/lib/venues/hours';
import type { GroupEvent } from '@/hooks/useGroupEvents';

// Render dialog content without a browser portal; production controls remain real.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
const future = { start_time: '2099-09-14T10:00:00Z', end_time: '2099-09-14T12:00:00Z' };
const program = { id: 'p1', title: 'Community open play', event_format: 'open_play', ...future, capacity: 8, waitlist_enabled: true, waitlist_limit: 2, rsvps: { going: 8, maybe: 0, not_going: 0, waitlist: 1 }, user_rsvp: null } as GroupEvent;
const dialog = (props: Partial<Parameters<typeof VenueProgramDialog>[0]> = {}) => renderToStaticMarkup(<VenueProgramDialog event={program} open onOpenChange={() => {}} venueName="Pickleball Palace" canRsvp onRsvp={() => 'going'} {...props} />);

describe('program registration presentation', () => {
  it('opens a visible loading surface instead of silently doing nothing', () => {
    const html = dialog({ event: null, loading: true });
    expect(html).toContain('role="dialog"'); expect(html).toContain('Loading your session');
    expect(html).not.toContain('Are you playing?');
  });
  it('shows a readable error and retry without RSVP controls', () => {
    const html = dialog({ error: { message: 'Membership unavailable' }, onRetry: () => {} });
    expect(html).toContain('Membership unavailable'); expect(html).toContain('Try again');
    expect(html).not.toContain('Are you playing?');
  });
  it('explains that a waitlist is not a confirmed spot', () => {
    expect(dialog()).toContain('Waitlist and Maybe responses do not confirm a spot');
    expect(dialog({ event: { ...program, user_rsvp: 'waitlist' } })).toContain('You are not confirmed');
  });
  it('does not advertise available waitlist places when the list is full', () => {
    const html = dialog({ event: { ...program, rsvps: { ...program.rsvps!, waitlist: 2 } } });
    expect(html).toContain('Waitlist full'); expect(html).not.toContain('Waitlist available');
    expect(html).toContain('Registration is full');
  });
  it('closes registration for ended events and keeps recorded responses visible', () => {
    const html = dialog({ event: { ...program, start_time: '2000-01-01T10:00:00Z', end_time: null, user_rsvp: 'going' } });
    expect(html).toContain('Registration is closed'); expect(html).not.toContain('Are you playing?');
  });
  it('offers the actual host community when registration requires membership', () => {
    const html = dialog({ canRsvp: false, onOpenHost: () => {} });
    expect(html).toContain('View host community'); expect(html).not.toContain('Are you playing?');
  });
});

describe('venue browsing presentation', () => {
  const home = (props: Partial<Parameters<typeof VenueHome>[0]> = {}) => renderToStaticMarkup(<VenueHome welcomeHeadline={null} welcomeMessage={null} city="Philadelphia" state="PA" phone="(215) 555-0123" email="hello@palace.example" websiteUrl="palace.example" hours={defaultVenueHours()} nextUp={[]} hasCourts freeNow={null} courtCount={6} onBook={() => {}} onOpenPlay={() => {}} {...props} />);
  it('makes phone, email and website actionable', () => {
    const html = home();
    expect(html).toContain('href="tel:2155550123"');
    expect(html).toContain('href="mailto:hello%40palace.example"');
    expect(html).toContain('href="https://palace.example/"');
  });
  it('distinguishes loading and unavailable programs from a legitimately empty schedule', () => {
    expect(home()).toContain('No upcoming programs');
    const loading = home({ loadingPrograms: true });
    expect(loading).toContain('Loading upcoming programs'); expect(loading).not.toContain('No upcoming programs');
    const error = home({ programsUnavailable: true, onRetryPrograms: () => {} });
    expect(error).toContain('Programs couldn’t load'); expect(error).not.toContain('No upcoming programs');
  });
  it('marks old full sessions as ended rather than advertising their waitlist', () => {
    const html = renderToStaticMarkup(<VenueProgramming sessions={[{ ...program, start_time: '2000-01-01T10:00:00Z', end_time: null, created_by: 'host', group_id: 'group' }]} going={{ p1: 8 }} loading={false} onPick={() => {}} />);
    expect(html).toContain('Ended'); expect(html).not.toContain('Waitlist available');
  });
});
