import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Settings } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';
import { VenueMobileShell, VenuePanel } from '@/components/venue/VenueMobileShell';
import { VenueClubHeader } from '@/components/venue/VenueClubHeader';
import { VenueAdminShell } from '@/components/community/admin/VenueAdminShell';
import { CollapsedComposerBar } from '@/components/community/CollapsedComposerBar';
import type { VenuePageTab } from '@/components/venue/VenuePageChrome';

vi.mock('@/hooks/useVisualViewportPane', () => ({ useVisualViewportPane: () => ({ height: '480px', top: '0px' }) }));
const noop = () => {};
const identity = { name: 'ELEVENO', logoUrl: '/saved-venue-logo.png', logoImageFit: 'contain' as const, logoShape: 'circle' as const };
const props = { mobile: true, identity, hasBooking: true, onCommunity: noop, onExit: noop, onBookings: noop, onTools: noop };
const pages: VenuePageTab[] = ['home', 'book', 'play', 'feed', 'chat', 'events', 'more'];
function renderShell(activeTab: VenuePageTab, mobile = true, visited = new Set<string>(pages)) {
  return renderToStaticMarkup(<Tabs value={activeTab}><VenueMobileShell {...props} mobile={mobile} activeTab={activeTab} visited={visited} footer={<div>composer-footer</div>}>
    {pages.map(value => <VenuePanel key={value} value={value}><div>{value}-page</div></VenuePanel>)}
  </VenueMobileShell></Tabs>);
}

describe('persistent venue mobile shell', () => {
  it.each(pages)('keeps the same branded header and six-section navigation in %s', activeTab => {
    const html = renderShell(activeTab);
    expect(html.match(/class="venue-app-bar"/g)).toHaveLength(1);
    expect(html.match(/role="tab" /g)).toHaveLength(6);
    expect(html).toContain('/saved-venue-logo.png');
    expect(html).toContain('Back to PULSE');
    expect(html.indexOf('venue-app-bar')).toBeLessThan(html.indexOf('venue-mobile-nav'));
    expect(html.indexOf('venue-mobile-nav')).toBeLessThan(html.indexOf('venue-app-body'));
    expect(html).toContain('height:480px');
    expect(html).toContain(`data-state="active"`);
  });
  it('keeps visited pages mounted but hidden and labels chat as Community', () => {
    const html = renderShell('chat');
    expect(html).toMatch(/data-state="active"[^>]*id="[^"]*trigger-chat"[^>]*>Community</);
    expect(html.match(/venue-app-panel hidden/g)).toHaveLength(6);
    expect(html).toContain('venue-app-panel venue-app-chat-panel');
    expect(html).toContain('home-page');
    expect(html).toContain('chat-page');
  });
  it('does not eagerly mount unvisited chat and does not add a second desktop shell', () => {
    const firstVisit = renderShell('home', true, new Set(['home']));
    expect(firstVisit).not.toContain('chat-page');
    const desktop = renderShell('home', false);
    expect(desktop).not.toContain('venue-mobile-shell');
    expect(desktop).not.toContain('composer-footer');
    expect(desktop).toContain('home-page');
  });
  it('keeps the overview hero inside content without duplicating header controls', () => {
    const html = renderToStaticMarkup(<VenueClubHeader embedded identity={identity} cover={{src:'/cover.png'}} courtCount={3} freeNow={2} hasBooking isAdmin isOperator onBack={noop} onSettings={noop} onOperations={noop} onBook={noop} onPlay={noop} onSchedule={noop} />);
    expect(html).toContain('<h2');
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('aria-label="Manage venue"');
    expect(html).not.toContain('aria-label="Back to Community"');
    expect(html).toContain('Book a Court');
  });
  it('lays the embedded post composer out below content instead of covering it', () => {
    const html = renderToStaticMarkup(<CollapsedComposerBar embedded onExpand={noop} />);
    expect(html).toContain('relative shrink-0');
    expect(html).toContain('h-11 min-w-0 flex-1');
    expect(html).not.toContain('fixed bottom-0');
    expect(renderToStaticMarkup(<CollapsedComposerBar onExpand={noop} />)).toContain('fixed bottom-0');
  });
  it('places management descriptions after the navigation rather than shifting it', () => {
    const html = renderToStaticMarkup(<VenueAdminShell venueName="ELEVENO" verified roleLabel="Owner" activeTab="settings" items={[{value:'settings',label:'Settings',description:'A description that may wrap on narrow screens',icon:Settings}]} onTabChange={noop} onBack={noop} onViewVenue={noop} onOperations={noop}><p>Settings form</p></VenueAdminShell>);
    expect(html.indexOf('Venue management sections')).toBeLessThan(html.indexOf('A description that may wrap'));
    expect(html).toContain('venue-management-body');
  });
  it('uses one production chat tree and retains the venue return path from community tools', () => {
    const page = readFileSync('src/pages/player/VenueCommunity.tsx', 'utf8');
    expect(page.match(/<GroupChat\s/g)).toHaveLength(1);
    expect(page).not.toContain('window.scrollTo');
    expect(page).toContain('<VenueMobileShell');
    expect(page).toContain('<VenueClubHeader embedded');
    const tools = readFileSync('src/pages/player/GroupDetail.tsx', 'utf8');
    expect(tools).toContain("searchParams.get('view') === 'community' ? `/player/community/group/${groupId}`");
  });
});
