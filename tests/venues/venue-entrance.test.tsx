import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueEntrance, VenueLoadingScreen, VENUE_ENTRANCE_MS, VENUE_SLOW_LOAD_MS } from '@/components/venue/VenueEntrance';
import { VenueBrandMark, venueInitials } from '@/components/venue/VenueBrandMark';

const state = vi.hoisted(() => ({ slots: [] as any[], index: 0, effects: [] as (() => any)[], cleanup: [] as (() => any)[], reduced: false, listeners: [] as (() => void)[], imageError: null as any }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual,
    useState: (initial: any) => {
      const index = state.index++;
      if (!(index in state.slots)) state.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [state.slots[index], (value: any) => { state.slots[index] = typeof value === 'function' ? value(state.slots[index]) : value; }];
    },
    useEffect: (effect: () => any) => { state.effects.push(effect); },
  };
});
vi.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }));
const identity = { name: 'Pickleball Palace', logoUrl: '/palace-logo.png', logoShape: 'circle' as const, logoImageFit: 'contain' as const, primaryColor: '#abc', secondaryColor: '#102030' };
const render = (patch = {}) => { state.index = 0; state.effects = []; return renderToStaticMarkup(<VenueEntrance identity={identity} {...patch}><button>Venue chat</button></VenueEntrance>); };
const mountEffects = () => { for (const effect of state.effects) { const cleanup = effect(); if (typeof cleanup === 'function') state.cleanup.push(cleanup); } };
beforeEach(() => {
  vi.useFakeTimers(); state.slots = []; state.index = 0; state.effects = []; state.cleanup = []; state.reduced = false; state.listeners = [];
  vi.stubGlobal('window', { setTimeout, matchMedia: () => ({ get matches() { return state.reduced; }, addEventListener: (_: string, fn: () => void) => state.listeners.push(fn), removeEventListener: vi.fn() }) });
});
afterEach(() => { state.cleanup.forEach(fn => fn()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('venue entrance lifecycle', () => {
  it('prepares children during the entrance and reveals them after 1.5 seconds', () => {
    expect(VENUE_ENTRANCE_MS).toBe(1500);
    const html = render(); expect(html).toContain('Venue chat'); expect(html).toContain('visibility:hidden'); mountEffects();
    vi.advanceTimersByTime(1499); expect(render()).toContain('data-testid="venue-entrance"');
    vi.advanceTimersByTime(1); expect(render()).not.toContain('data-testid="venue-entrance"');
    expect(render()).not.toContain('visibility:hidden');
  });
  it('does not replay the entrance for an internal tab rerender or brand update', () => {
    render(); mountEffects(); vi.advanceTimersByTime(VENUE_ENTRANCE_MS);
    expect(render({ identity: { ...identity, name: 'Updated Palace' } })).not.toContain('data-testid="venue-entrance"');
  });
  it('waits for real prerequisites, explains a slow connection and always offers a way back', () => {
    render({ pending: true }); mountEffects(); vi.advanceTimersByTime(VENUE_SLOW_LOAD_MS);
    const html = render({ pending: true }); expect(html).toContain('Taking a little longer'); expect(html).toContain('href="/player/community"');
    expect(html).not.toContain('Venue chat');
    render(); mountEffects(); expect(render()).not.toContain('data-testid="venue-entrance"');
  });
  it('never hides an error screen, even if a request is also pending', () => {
    const html = render({ pending: true, bypass: true }); expect(html).toContain('Venue chat');
    expect(html).not.toContain('visibility:hidden'); expect(html).not.toContain('data-testid="venue-entrance"');
  });
  it('does not impose the decorative delay when reduced motion is requested', () => {
    state.reduced = true; render(); mountEffects();
    expect(render()).not.toContain('data-testid="venue-entrance"');
  });
  it('honors reduced motion when the preference changes during entrance', () => {
    render(); mountEffects(); state.reduced = true; state.listeners.forEach(fn => fn());
    expect(render()).not.toContain('data-testid="venue-entrance"');
  });
  it('cleans up scheduled work when leaving the venue', () => {
    render(); mountEffects(); state.cleanup.forEach(fn => fn()); state.cleanup = [];
    expect(vi.getTimerCount()).toBe(0);
  });
});
describe('venue entrance identity', () => {
  it('uses saved logo, display and sanitized colors without an additional database setting', () => {
    const html = renderToStaticMarkup(<VenueLoadingScreen identity={identity} />);
    expect(html).toContain('alt="Pickleball Palace logo"'); expect(html).toContain('object-fit:contain'); expect(html).toContain('rounded-full');
    expect(html).toContain('--venue-entrance-accent:#aabbcc'); expect(html).toContain('role="status"');
    const unsafe = renderToStaticMarkup(<VenueLoadingScreen identity={{ ...identity, primaryColor: 'url(https://untrusted.invalid)', secondaryColor: 'red;display:none' }} />);
    expect(unsafe).not.toContain('untrusted.invalid'); expect(unsafe).not.toContain('display:none');
  });
  it('previews draft identity inline without a portal, navigation or a page-level heading', () => {
    const html = renderToStaticMarkup(<VenueLoadingScreen preview identity={identity} />);
    expect(html).toContain('Venue entrance preview'); expect(html).toContain('<h3'); expect(html).not.toContain('<h1');
    expect(html).not.toContain('href='); expect(html).not.toContain('fixed inset-0');
  });
  it('provides initials for absent and failed images and accepts a replacement URL', () => {
    expect(venueInitials(' Pickleball  Palace ')).toBe('PP'); expect(venueInitials('ELEVENO')).toBe('E'); expect(venueInitials('')).toBe('V');
    state.index = 0; state.slots = ['/palace-logo.png'];
    expect(renderToStaticMarkup(<VenueBrandMark {...identity} />)).not.toContain('<img');
    state.index = 0; expect(renderToStaticMarkup(<VenueBrandMark {...identity} logoUrl="/replacement.png" />)).toContain('/replacement.png');
    state.index = 0; const empty = renderToStaticMarkup(<VenueBrandMark name="Pickleball Palace" />);
    expect(empty).toContain('PP'); expect(empty).not.toContain('<img');
    state.index = 0; state.slots = [null, null];
    expect(renderToStaticMarkup(<VenueBrandMark {...identity} secondaryColor="#fff" />)).not.toContain('background-color:#ffffff');
    state.index = 0; state.slots = [null, identity.logoUrl];
    expect(renderToStaticMarkup(<VenueBrandMark {...identity} secondaryColor="#fff" />)).toContain('background-color:#ffffff');
  });
});
