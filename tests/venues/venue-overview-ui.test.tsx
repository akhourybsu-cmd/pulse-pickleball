import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueAdminOverview } from '@/components/community/admin/VenueAdminOverview';

const state = vi.hoisted(() => ({ query: {} as any, keys: [] as unknown[][] }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => { state.keys.push(options.queryKey); return state.query; } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const counts = { courts: 0, staff: 1, upcoming: 0, posts: 3, members: 28, pendingMembers: 3, contactReady: false };
const render = (props: Partial<Parameters<typeof VenueAdminOverview>[0]> = {}) => renderToStaticMarkup(<VenueAdminOverview venueId="venue" groupId="group" viewerId="owner" venueName="ELEVENO" memberCount={99} canManageCommunity chatEnabled isOwner verified={false} bookingEnabled={false} operationsEnabled={false} countsOverride={counts} onOpenTab={() => {}} onOperations={() => {}} onOpenVenueTab={() => {}} onMembers={() => {}} onVerification={() => {}} {...props} />);
beforeEach(() => { state.query = { data: undefined, isPending: false, isError: false }; state.keys = []; });

describe('venue management overview', () => {
  it('gives free venues useful controls and actionable requests without requiring paid tools', () => {
    const html = render();
    for (const copy of ['Next steps', '3 join requests to review', 'Review verification', 'Edit contact details', 'Open programs', 'Profile &amp; brand', 'Community controls', 'Community roles', 'Plan &amp; upgrades']) expect(html).toContain(copy);
    expect(html).not.toContain('Courts &amp; hours'); expect(html).not.toContain('Open live operations');
    expect(html).toContain('>28</p>'); expect(html).not.toContain('>99</p>');
    expect(state.keys).toEqual([['venue-admin-counts', 'venue', 'group', 'owner', true]]);
  });
  it('does not mistake an unavailable summary for empty data or an all-clear', () => {
    state.query.isError = true;
    const html = render({ countsOverride: undefined, verified: true });
    expect(html).toContain('Members unavailable'); expect(html).toContain('Retry totals');
    expect(html).not.toContain('No outstanding items'); expect(html).not.toContain('Plan your next session');
    expect(html).toContain('Profile &amp; brand');
  });
  it('does not enable facility shortcuts from stale or unconfirmed access', () => {
    for (const access of [{ accessError: true }, { accessLoading: true }]) {
      const html = render({ bookingEnabled: true, operationsEnabled: true, ...access });
      expect(html).not.toContain('Open live operations'); expect(html).not.toContain('Courts &amp; hours');
      expect(html).not.toContain('>Book<'); expect(html).toContain('Community controls');
    }
  });
  it('does not present owner-only or moderation tasks to a facility manager', () => {
    const html = render({ isOwner: false, canManageCommunity: false, verified: false, bookingEnabled: true });
    expect(html).not.toContain('Review requests'); expect(html).not.toContain('Review verification');
    expect(html).not.toContain('Community roles'); expect(html).toContain('View court booking');
  });
});
