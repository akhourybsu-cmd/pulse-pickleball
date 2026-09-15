import { renderToStaticMarkup } from 'react-dom/server';
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
  it('moves identity below full-photo banners while retaining the filled-header composition', () => {
    const props = { venueName: 'Test venue', coverImageUrl: '/cover.png', hasCourts: false, freeNow: null, courtCount: 0, memberCount: 1, isOperator: false, isAdmin: false, onBack: vi.fn(), onOperations: vi.fn(), onSettings: vi.fn() };
    const full = renderToStaticMarkup(<VenueMasthead {...props} coverImageFit="contain" />);
    const filled = renderToStaticMarkup(<VenueMasthead {...props} coverImageFit="cover" />);
    expect(full).toContain('relative bg-card py-4'); expect(full).not.toContain('absolute inset-x-0 bottom-0 pb-4');
    expect(filled).toContain('absolute inset-x-0 bottom-0 pb-4'); expect(full).toContain('clamp(11rem,25vw,18rem)');
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
    expect(html).toContain('390 / 176'); expect(html).toContain('1440 / 288'); expect(html.match(/object-position:center top/g)).toHaveLength(2);
    expect(html).toContain('Phone banner preview'); expect(html).toContain('Desktop banner preview');
  });
  it('uses the venue logo and saved fit/shape instead of a stale community icon in both lists', () => {
    const group = { id: 'v1', name: 'Test venue', type: 'venue_official', icon_url: '/stale.png', venue: { name: 'Test venue', logo_url: '/wide-logo.png', logo_image_fit: 'contain', logo_shape: 'circle' } } as GroupWithMembership;
    for (const html of [renderToStaticMarkup(<GroupCard group={group} />), renderToStaticMarkup(<ReorderableGroupList groups={[group]} />)]) {
      expect(html).toContain('/wide-logo.png'); expect(html).not.toContain('/stale.png'); expect(html).toContain('object-fit:contain'); expect(html).toContain('rounded-full');
    }
  });
});
