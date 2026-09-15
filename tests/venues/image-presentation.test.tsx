import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { VenueCoverImage } from '@/components/venue/VenueCoverImage';
import { VenueBrandMark } from '@/components/venue/VenueBrandMark';
import { VenueImagePreview } from '@/components/venue/VenueImagePreview';
import { VenueMasthead } from '@/components/venue/VenuePageChrome';
import { GroupCard } from '@/components/community/GroupCard';
import { ReorderableGroupList } from '@/components/community/ReorderableGroupList';
import type { GroupWithMembership } from '@/hooks/useGroups';
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ prefetchQuery: vi.fn() }) }));
vi.mock('@/hooks/useGroupPosts', () => ({ fetchGroupPosts: vi.fn() }));
vi.mock('@/hooks/useGroupEvents', () => ({ fetchGroupEvents: vi.fn() }));
const identity = { name: 'Test venue', logoUrl: '/wide-logo.png', logoImageFit: 'contain' as const, logoShape: 'circle' as const };
describe('venue image presentation', () => {
  it('caps free venue desktop covers and keeps them out of the persistent mobile header', () => {
    const source = readFileSync('src/pages/player/GroupDetail.tsx', 'utf8');
    expect(source).toContain("isVenueGroup && group.venue?.cover_image_url && activeTab !== 'chat'");
    expect(source).toContain('hidden relative h-[clamp(7rem,20vw,12rem)] w-full shrink-0 overflow-hidden bg-[#171a1f] lg:block lg:h-24 xl:h-28');
  });
  it('keeps identity below both desktop cover modes and caps the cover independently of screen width', () => {
    const props = { venueName: 'Test venue', coverImageUrl: '/cover.png', hasCourts: false, freeNow: null, courtCount: 0, memberCount: 1, isOperator: false, isAdmin: false, onBack: vi.fn(), onOperations: vi.fn(), onSettings: vi.fn() };
    const full = renderToStaticMarkup(<VenueMasthead {...props} coverImageFit="contain" />);
    const filled = renderToStaticMarkup(<VenueMasthead {...props} coverImageFit="cover" />);
    for (const html of [full, filled]) {
      expect(html).toContain('data-testid="venue-desktop-identity"');
      expect(html).toContain('h-24 overflow-hidden xl:h-28');
      expect(html).not.toContain('clamp(11rem,25vw,18rem)');
      expect(html).not.toContain('absolute inset-x-0 bottom-0');
      expect(html).toContain('h-12 w-12');
      expect(html.indexOf('data-testid="venue-desktop-cover"')).toBeLessThan(html.indexOf('data-testid="venue-desktop-identity"'));
      expect(html).not.toContain('lg:text-[40px]');
    }
    expect(full).toContain('object-fit:contain'); expect(filled).toContain('object-fit:cover');
  });
  it('uses contain or cover without permitting intrinsic image dimensions to stretch the frame', () => {
    const html = renderToStaticMarkup(<VenueCoverImage src="/cover.png" fit="contain" focalPoint="top" />);
    expect(html).toContain('object-fit:contain'); expect(html).toContain('object-position:center top'); expect(html).toContain('absolute inset-0 h-full w-full');
    expect(renderToStaticMarkup(<VenueCoverImage src="/cover.png" />)).toContain('object-fit:cover');
    expect(renderToStaticMarkup(<VenueCoverImage />)).toBe('');
  });
  it('fits the full logo inside a circle, including all four corners', () => {
    const html = renderToStaticMarkup(<VenueBrandMark {...identity} />);
    expect(html).toContain('aspect-square'); expect(html).toContain('object-fit:contain'); expect(html).toContain('padding:15%');
    expect(renderToStaticMarkup(<VenueBrandMark {...identity} logoImageFit="cover" />)).toContain('padding:0');
  });
  it('defaults unconfigured logos to full-image fit and keeps square padding subtle', () => {
    const html = renderToStaticMarkup(<VenueBrandMark name="Test venue" logoUrl="/logo.png" />);
    expect(html).toContain('object-fit:contain'); expect(html).toContain('padding:4%');
  });
  it('previews distinct phone and desktop banner proportions with the same saved settings', () => {
    const html = renderToStaticMarkup(<VenueImagePreview identity={identity} cover={{ src: '/cover.png', fit: 'contain', focalPoint: 'top' }} />);
    expect(html).toContain('390 / 100'); expect(html).toContain('1440 / 112'); expect(html.match(/object-position:center top/g)).toHaveLength(2);
    expect(html).toContain('Phone banner preview'); expect(html).toContain('Desktop banner preview');
  });
  it('uses the venue logo and saved fit/shape instead of a stale community icon in both lists', () => {
    const group = { id: 'v1', name: 'Test venue', type: 'venue_official', icon_url: '/stale.png', venue: { name: 'Test venue', logo_url: '/wide-logo.png', logo_image_fit: 'contain', logo_shape: 'circle' } } as GroupWithMembership;
    for (const html of [renderToStaticMarkup(<GroupCard group={group} />), renderToStaticMarkup(<ReorderableGroupList groups={[group]} />)]) {
      expect(html).toContain('/wide-logo.png'); expect(html).not.toContain('/stale.png'); expect(html).toContain('object-fit:contain'); expect(html).toContain('rounded-full');
    }
  });
});
