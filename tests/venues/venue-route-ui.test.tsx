import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupRoute from '@/pages/player/GroupRoute';

const state = vi.hoisted(() => ({
  group: {} as any, modules: {} as any, params: new URLSearchParams(), setParams: vi.fn(),
  buttons: [] as { label: string; click?: () => any }[],
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>(); let index = 0;
  return { ...actual, lazy: () => { const label = ++index === 1 ? 'Free community shell' : 'Facility shell'; return () => actual.createElement('p', null, label); } };
});
vi.mock('react-router-dom', () => ({ useSearchParams: () => [state.params, state.setParams], useParams: () => ({ groupId: 'group' }) }));
vi.mock('@/hooks/useGroupDetail', () => ({ useGroupDetail: () => state.group }));
vi.mock('@/hooks/useVenueModules', () => ({ useVenueModules: () => state.modules }));
vi.mock('@/lib/venues/featureFlag', () => ({ isVenueCommunitiesEnabled: () => true }));
vi.mock('@/components/venue/VenueStaffContext', () => ({ VenueStaffProvider: ({ children }: any) => children }));
vi.mock('@/components/venue/VenueLoadState', () => ({ VenueLoadState: () => <p>Venue data unavailable</p> }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick }: any) => { state.buttons.push({ label: children, click: onClick }); return <button>{children}</button>; } }));
const render = () => renderToStaticMarkup(<GroupRoute />);
beforeEach(() => {
  vi.clearAllMocks(); state.buttons = []; state.params = new URLSearchParams('tab=members');
  state.group = { group: { venue_id: 'venue', venue: { name: 'ELEVENO' } }, loading: false, isError: false, refetch: vi.fn() };
  state.modules = { loading: false, isError: false, booking: true, facility: true, refetch: vi.fn() };
});

describe('venue community fallback routing', () => {
  it('uses the facility shell only with confirmed feature access', () => {
    expect(render()).toContain('Facility shell'); state.modules.booking = false; state.modules.facility = false;
    expect(render()).toContain('Free community shell');
  });
  it('offers the free community when module loading fails, preserving the requested member tab', () => {
    state.modules.isError = true; const html = render();
    expect(html).toContain('Facility features couldn’t load'); expect(html).not.toContain('Facility shell');
    state.buttons.find(button => button.label === 'Open community')!.click!();
    expect(state.setParams.mock.calls[0][0].get('view')).toBe('community');
    expect(state.setParams.mock.calls[0][0].get('tab')).toBe('members');
  });
  it('opens explicit community links without waiting for optional access checks', () => {
    state.params.set('view', 'community'); state.modules.loading = true;
    expect(render()).toContain('Free community shell');
    state.modules.loading = false; state.modules.isError = true;
    expect(render()).toContain('Free community shell');
  });
  it('never bypasses a failed or missing core community query', () => {
    state.params.set('view', 'community'); state.group.isError = true;
    expect(render()).toContain('Venue data unavailable'); expect(render()).not.toContain('Free community shell');
  });
});
