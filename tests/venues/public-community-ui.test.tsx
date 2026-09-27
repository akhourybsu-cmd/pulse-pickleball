import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCommunity from '@/pages/public/PublicCommunity';
import { GuestAccountPrompt } from '@/components/community/GuestAccountPrompt';

const state = vi.hoisted(() => ({ query: {} as any }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ isAuthenticated: false }) }));
vi.mock('@/hooks/usePublicCommunity', () => ({ usePublicCommunity: () => state.query }));
const render = (path = '/venues/palace') => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><PublicCommunity /></MemoryRouter>);
beforeEach(() => {
  state.query = { data: { id: 'community', name: 'Palace', description: 'Find your people', member_count: 20, join_method: 'request_to_join', courts: [{ id: 'court', name: 'Center court', court_number: 1 }], venue: { name: 'Palace', slug: 'palace', booking_enabled: true } }, isLoading: false, isError: false, refetch: vi.fn() };
});
describe('guest community surfaces', () => {
  it('renders a venue before authentication with clear account requirements', () => {
    const html = render();
    expect(html).toContain('Welcome to Palace');
    expect(html).toContain('Request to join');
    expect(html).toContain('Create a free account');
    expect(html).toContain('You’re welcome to look around.');
    expect(html).toContain('mode=signup');
    expect(html).toContain('mode=signin');
  });
  it('allows court browsing, and offers booking only when enabled', () => {
    expect(render('/venues/palace?tab=book')).toContain('Center court');
    expect(render('/venues/palace?tab=book')).toContain('Check availability');
    state.query.data.venue.booking_enabled = false;
    expect(render('/venues/palace?tab=book')).not.toContain('Check availability');
    expect(render()).not.toContain('book courts');
  });
  it('gates deep-linked chat and events while keeping their exact signup destination', () => {
    const html = render('/venues/palace?tab=chat&view=community#latest');
    expect(html).toContain('There’s more waiting for you');
    expect(html).toContain('redirect=%2Fvenues%2Fpalace%3Ftab%3Dchat%26view%3Dcommunity%23latest');
    expect(html).not.toContain('textarea');
  });
  it('keeps loading, connection failure and unavailable communities distinct', () => {
    state.query.isLoading = true;
    expect(render()).toContain('Opening the community');
    state.query.isLoading = false; state.query.isError = true;
    expect(render()).toContain('Try again');
    state.query.isError = false; state.query.data = null;
    expect(render()).toContain('isn’t available to browse');
    expect(render()).not.toContain('Welcome to Palace');
  });
  it('renders ordinary communities without venue-only controls', () => {
    state.query.data.venue = null;
    const html = render('/player/community/group/community');
    expect(html).toContain('Find your people');
    expect(html).not.toContain('Plan your visit');
    expect(html).not.toContain('>Courts<');
  });
  it('uses the action destination in both account choices', () => {
    const html = renderToStaticMarkup(<MemoryRouter><GuestAccountPrompt returnTo="/venues/palace?tab=book" action="book a court" /></MemoryRouter>);
    expect(html).toContain('mode=signup&amp;redirect=%2Fvenues%2Fpalace%3Ftab%3Dbook');
    expect(html).toContain('mode=signin&amp;redirect=%2Fvenues%2Fpalace%3Ftab%3Dbook');
  });
});
