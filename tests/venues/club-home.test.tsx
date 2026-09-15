import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { VenueClubHeader } from '@/components/venue/VenueClubHeader';
import { VenueClubHome, ClubSessionCard, VenueClubCommunityNav, VenueClubAbout } from '@/components/venue/VenueClubHome';
import { VenueMobileTabs } from '@/components/venue/VenuePageChrome';
import { Tabs } from '@/components/ui/tabs';
import { clubAccent, clubDate, clubHoursStatus, clubTime } from '@/lib/venues/clubPresentation';
import { initialVenueCommunityTab, venueTabParams } from '@/lib/venues/navigation';

const noop = vi.fn();
const header = { identity:{ name:'ELEVENO',logoUrl:'/logo.png',logoImageFit:'contain' as const },cover:{src:'/banner.png',fit:'contain' as const},courtCount:3,freeNow:2,hasBooking:true,isAdmin:false,isOperator:false,onBack:noop,onSettings:noop,onOperations:noop,onBook:noop,onPlay:noop,onSchedule:noop };
const home = { name:'ELEVENO',hasBooking:true,sessions:[],players:[],memberCount:26,onlineCount:2,onRetry:noop,onBook:noop,onPlay:noop,onSchedule:noop,onCommunity:noop,onMembers:noop,onAbout:noop,onPick:noop };

describe('club mobile presentation', () => {
  it('has exactly five text sections, with booking and chat outside the primary tab bar', () => {
    const html=renderToStaticMarkup(<Tabs value="home"><VenueMobileTabs activeTab="home" /></Tabs>);
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    for(const label of ['Overview','Play','Community','Events','About']) expect(html).toContain(`>${label}<`);
    expect(html).not.toContain('trigger-book');expect(html).not.toContain('trigger-chat');
  });
  it('keeps existing booking/chat deep links and makes Events round-trip without losing other parameters', () => {
    for(const tab of ['book','chat','events'] as const){const params=venueTabParams(new URLSearchParams('invite=abc'),tab);expect(initialVenueCommunityTab(params)).toBe(tab);expect(params.get('invite')).toBe('abc');}
  });
  it('leads with venue identity and real labeled court availability, never invented stars or playing counts', () => {
    const html=renderToStaticMarkup(<VenueClubHeader {...header} city="North Attleboro" state="MA" />);
    expect(html).toContain('North Attleboro, MA');expect(html).toContain('3 courts');expect(html).toContain('2 courts free');expect(html).toContain('Hours not listed');
    expect(html).not.toContain('playing now');expect(html).not.toContain('Indoor');expect(html).not.toContain('Manage venue');
    expect(html).toContain('Book a Court');expect(html).toContain('Join Open Play');expect(html).toContain('View Schedule');
  });
  it('omits staff controls and zero-as-unknown availability for players', () => {
    const html=renderToStaticMarkup(<VenueClubHeader {...header} freeNow={null} />);
    expect(html).not.toContain('courts free');expect(html).not.toContain('Venue operations');expect(html).not.toContain('Manage venue');
    expect(renderToStaticMarkup(<VenueClubHeader {...header} isAdmin isOperator />)).toContain('Manage venue');
  });
  it('opens a focused booking flow, with a named return control and no promotional hero', () => {
    const html=renderToStaticMarkup(<VenueClubHeader {...header} booking />);
    expect(html).toContain('Back to venue overview');expect(html).toContain('club-booking-title');expect(html).not.toContain('/banner.png');expect(html).not.toContain('Join Open Play');
  });
  it('moves description below sessions, ways to play and community, and keeps billing off the player home', () => {
    const html=renderToStaticMarkup(<VenueClubHome {...home} welcomeMessage="Club biography" />);
    expect(html.indexOf('Upcoming venue sessions')).toBeLessThan(html.indexOf('Ways to play'));expect(html.indexOf('Venue community')).toBeLessThan(html.indexOf('Club biography'));
    expect(html).not.toContain('upgrades');expect(html).not.toContain('features enabled');
    const source=readFileSync(new URL('../../src/pages/player/VenueCommunity.tsx',import.meta.url),'utf8');expect(source).not.toContain('Venue features enabled');expect(source).not.toContain('Plan &amp; upgrades');
  });
  it('does not offer booking when the venue does not have booking access', () => {
    expect(renderToStaticMarkup(<VenueClubHome {...home} hasBooking={false} />)).not.toContain('Book a Court');
    expect(renderToStaticMarkup(<VenueClubHeader {...header} hasBooking={false} />)).not.toContain('Book a Court');
  });
  it('uses honest empty/error states and does not fabricate community players', () => {
    const html=renderToStaticMarkup(<VenueClubHome {...home} memberCount={0} onlineCount={0} />);
    expect(html).toContain('No upcoming sessions are listed');expect(html).toContain('Meet your community');expect(html).not.toContain('Sarah');expect(html).not.toContain('online now');
    const failed=renderToStaticMarkup(<VenueClubHome {...home} error />);expect(failed).toContain('Schedule unavailable');expect(failed).not.toContain('No upcoming sessions are listed');
  });
  it('shows a real roster count when known and avoids fake remaining spots when unknown', () => {
    const session={id:'s',title:'Intermediate Open Play',description:null,start_time:'2099-09-15T20:00:00Z',end_time:'2099-09-15T22:00:00Z',capacity:16,going:8,skill_level_min:3,skill_level_max:3.75};
    const html=renderToStaticMarkup(<ClubSessionCard session={session} timeZone="America/New_York" onPick={noop} />);
    expect(html).toContain('8 / 16 players');expect(html).toContain('4:00 PM');expect(html).toContain('3.0–3.75');
    const unknown=renderToStaticMarkup(<ClubSessionCard session={{...session,going:undefined}} onPick={noop} />);expect(unknown).toContain('View availability');expect(unknown).not.toContain('0 / 16');
  });
  it('keeps chat and player lists reachable within Community, respecting disabled chat', () => {
    const html=renderToStaticMarkup(<VenueClubCommunityNav section="posts" onPosts={noop} onMembers={noop} onChat={noop} />);expect(html).toContain('Players');expect(html).toContain('Chat');
    expect(renderToStaticMarkup(<VenueClubCommunityNav section="members" onPosts={noop} onMembers={noop} />)).not.toContain('Chat');
  });
  it('renders contact links safely and does not supply fabricated weekly hours', () => {
    const html=renderToStaticMarkup(<VenueClubAbout name="ELEVENO" websiteUrl="javascript:alert(1)" />);
    expect(html).toContain('Hours not listed');expect(html).not.toContain('javascript:');expect(html).not.toContain('10 PM');
  });
});

describe('club status and accent', () => {
  it('uses the venue timezone for dates and hours, not the viewer timezone', () => {
    const now=new Date('2026-09-15T01:00:00Z');
    expect(clubDate('2026-09-15T01:30:00Z','America/New_York',now)).toBe('Today');
    expect(clubTime('2026-09-15T01:30:00Z','America/New_York')).toBe('9:30 PM');
    expect(clubHoursStatus({days:{1:{open:'08:00',close:'22:00'}}},'America/New_York',now)).toBe('Open until 10 PM');
  });
  it('distinguishes closed, opening later, malformed and missing schedules', () => {
    const now=new Date('2026-09-14T11:00:00Z'), zone='America/New_York';
    expect(clubHoursStatus(null,zone,now)).toBe('Hours not listed');expect(clubHoursStatus({days:{1:null}},zone,now)).toBe('Closed today');
    expect(clubHoursStatus({days:{1:{open:'08:00',close:'22:00'}}},zone,now)).toBe('Opens 8 AM');
    expect(clubHoursStatus({days:{1:{open:'25:00',close:'22:00'}}},zone,now)).toBe('Hours not listed');
  });
  it('chooses contrasting button text for pale, dark and invalid saved accents', () => {
    expect(clubAccent('#fff')['--club-on-accent']).toBe('#000000');expect(clubAccent('#000')['--club-on-accent']).toBe('#ffffff');
    expect(clubAccent('#C9962F')['--club-on-accent']).toBe('#000000');expect(clubAccent('url(x)')['--club-accent']).toBe('#c9962f');
  });
});
