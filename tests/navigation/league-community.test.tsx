import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rows: vi.fn(), host: vi.fn(), from: vi.fn() }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: { id: 'player' } }) }));
vi.mock('@/lib/leagues/data', () => ({ leagueRows: mock.rows }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from } }));
import { useLeagueSeasons } from '@/hooks/useLeagueSeasons';
import { LeagueHostLink } from '@/components/leagues/LeagueHostLink';
import { useReturnNavigation } from '@/hooks/useReturnNavigation';
let view: ReactTestRenderer, client: QueryClient;
let seasons: ReturnType<typeof useLeagueSeasons>, location: ReturnType<typeof useLocation>, back: ReturnType<typeof useReturnNavigation>;
function Harness() {
  seasons = useLeagueSeasons('ladder'); location = useLocation(); back = useReturnNavigation();
  return <LeagueHostLink communityId="rally" userId="player" />;
}
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mock.rows.mockResolvedValue([{ id: 'summer', name: 'Summer', status: 'completed' }, { id: 'autumn', name: 'Autumn', status: 'active' }]);
  mock.host.mockResolvedValue({ data: { name: 'Rally House Sports' }, error: null });
  mock.from.mockImplementation(() => {
    const chain = { select: () => chain, eq: () => chain, abortSignal: () => chain, maybeSingle: mock.host };
    return chain;
  });
});
afterEach(() => { act(() => view?.unmount()); client.clear(); });
const mount = async () => {
  await act(async () => { view = create(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: '/player/leagues/ladder', search: '?season=summer', hash: '#standings', state: { returnContext: { to: '/player/community/group/rally?tab=events', label: 'Community', scrollY: 0 } } }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Harness /></MemoryRouter></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
};
it('keeps the selected tab and community return destination when switching seasons', async () => {
  await mount();
  act(() => seasons.setSeasonId('autumn'));
  expect(location.search).toBe('?season=autumn');
  expect(location.hash).toBe('#standings');
  expect(back.label).toBe('Community');
  const link = view.root.findByType(Link);
  expect(link.props.to).toBe('/player/community/group/rally');
  expect(link.props.state.returnContext.to).toBe('/player/leagues/ladder?season=autumn#standings');
  expect(JSON.stringify(view.toJSON())).toContain('Hosted by Rally House Sports');
});
it('uses a neutral host link when the group name is unavailable', async () => {
  mock.host.mockResolvedValue({ data: null, error: null });
  await mount();
  expect(JSON.stringify(view.toJSON())).toContain('View host community');
  expect(view.root.findByType(Link).props.to).toBe('/player/community/group/rally');
});
