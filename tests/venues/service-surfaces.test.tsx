import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import { VenueDesktopNavigation, VenueMobileTabs } from '@/components/venue/VenuePageChrome';
import { VenueHome } from '@/components/venue/VenueHome';
import { VenueProgramming } from '@/components/venue/VenueProgramming';
import { defaultVenueHours } from '@/lib/venues/hours';
import { programService, venueTabService } from '@/lib/venues/servicePresentation';
import type { VenueDaySession } from '@/hooks/useVenueDay';

const noop = () => {};
describe('venue service presentation', () => {
  it('distinguishes booking, sessions, coaching and competition without granting access', () => {
    expect(venueTabService('book')).toBe('booking'); expect(venueTabService('play')).toBe('programs'); expect(venueTabService('events')).toBe('programs');
    expect(venueTabService('chat')).toBe('community'); expect(venueTabService('unknown')).toBe('community');
    expect(programService('open_play')).toBe('programs'); expect(programService('clinic')).toBe('coaching');
    expect(programService('practice')).toBe('coaching'); expect(programService('round_robin')).toBe('competition');
    expect(programService('social')).toBe('community'); expect(programService('unknown')).toBe('programs');
  });
  it('omits unavailable booking and disabled chat navigation on mobile', () => {
    const html=renderToStaticMarkup(<Tabs value="home"><VenueMobileTabs hasCourts={false} chatEnabled={false} /></Tabs>);
    expect(html).toContain('aria-label="Venue sections"'); expect(html).not.toContain('trigger-book'); expect(html).not.toContain('trigger-chat');
    expect(html).toContain('trigger-play'); expect(html).toContain('trigger-feed');
  });
  it('keeps settings reachable for a manager without operations access', () => {
    const html=renderToStaticMarkup(<Tabs value="home"><VenueDesktopNavigation hasCourts isAdmin isOperator={false} onOperations={noop} onSettings={noop} /></Tabs>);
    expect(html).toContain('Manage venue'); expect(html).not.toContain('>Operations<');
  });
  it('does not display staff controls to a player', () => {
    const html=renderToStaticMarkup(<Tabs value="book"><VenueDesktopNavigation hasCourts isAdmin={false} isOperator={false} onOperations={noop} onSettings={noop} /></Tabs>);
    expect(html).not.toContain('Manage venue'); expect(html).not.toContain('>Operations<');
    expect(html).toContain('data-venue-service="booking"');
  });
  it('retains real booking and schedule entry points with distinct service colors', () => {
    const html=renderToStaticMarkup(<VenueHome welcomeHeadline="ELEVENO" welcomeMessage={null} city={null} state={null} phone={null} websiteUrl={null} hours={defaultVenueHours()} nextUp={[]} hasCourts freeNow={null} courtCount={2} onBook={noop} onOpenPlay={noop} onBookings={noop} accent="#ffffff" />);
    expect(html).toContain('Book a court'); expect(html).toContain('Find a session'); expect(html).toContain('My bookings');
    expect(html).toContain('data-venue-service="booking"'); expect(html).toContain('data-venue-service="programs"');
    expect(html).not.toContain('0 of 2 open'); expect(html).not.toMatch(/(?:style="|;)color:#ffffff/);
  });
  it('labels session types as well as using color; capacity semantics are preserved', () => {
    const sessions=['clinic','round_robin'].map((event_format,index)=>({id:String(index),event_format,title:event_format,start_time:'2099-10-01T10:00:00Z',end_time:'2099-10-01T12:00:00Z',capacity:8,waitlist_enabled:true} as VenueDaySession));
    const html=renderToStaticMarkup(<VenueProgramming sessions={sessions} going={{'0':8,'1':6}} loading={false} onPick={noop} />);
    expect(html).toContain('data-venue-service="coaching"'); expect(html).toContain('data-venue-service="competition"');
    expect(html).toContain('Clinic'); expect(html).toContain('Round Robin');
    expect(html).toContain('Waitlist available'); expect(html).toContain('2 spots left');
  });
});

const css=readFileSync('src/styles/venue-surfaces.css','utf8');
function rgb(h:number,s:number,l:number) {
  s/=100; l/=100;
  const a=s*Math.min(l,1-l);
  return [0,8,4].map(n=>{ const k=(n+h/30)%12; return l-a*Math.max(-1,Math.min(k-3,9-k,1)); });
}
function luminance(channels:number[]) { return channels.map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0); }
function ratio(a:number[],b:number[]) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
describe('venue surface accessibility',()=>{
  it('uses at least 4.5:1 text contrast for each service tone and solid selection',()=>{
    const tokens=[...css.matchAll(/(?:^|\n)(\.dark )?\[data-venue-service(?:="[^"]+")?\]\s*\{\s*--venue-service:\s*(\d+) (\d+)% (\d+)%;/g)];
    expect(tokens).toHaveLength(12);
    for(const token of tokens) {
      const foreground=rgb(+token[2],+token[3],+token[4]);
      const canvas=token[1] ? rgb(220,25,10) : [1,1,1];
      const wash=foreground.map((channel,i)=>0.1*channel+0.9*canvas[i]);
      expect(ratio(foreground,wash)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(foreground,canvas)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('limits hover movement to fine pointers and disables motion on request',()=>{
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    const reduced=css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('transition: none'); expect(reduced).toContain('transform: none'); expect(reduced).toContain('animation: none');
  });
});
