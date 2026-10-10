import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: { id: 'me' }, loading: false }) }));
vi.mock('@/hooks/useMatchHistory', () => ({ useMatchHistory: mocks.history }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/ui/avatar', () => ({ Avatar: ({ children }: React.PropsWithChildren) => <span>{children}</span>, AvatarImage: () => null, AvatarFallback: ({ children }: React.PropsWithChildren) => <span>{children}</span> }));
vi.mock('@/components/ui/alert-dialog', () => {
  const Box = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return { AlertDialog: () => null, AlertDialogContent: Box, AlertDialogHeader: Box, AlertDialogFooter: Box, AlertDialogTitle: Box, AlertDialogDescription: Box, AlertDialogCancel: Box, AlertDialogAction: Box };
});
vi.mock('@/components/ui/sheet', () => ({ Sheet: () => null, SheetContent: () => null, SheetDescription: () => null, SheetHeader: () => null, SheetTitle: () => null }));
import MatchHistory from '@/pages/MatchHistory';
import { matchHistoryPath } from '@/lib/navigation/matchLink';
import type { HistoryMatch } from '@/lib/matchHistory';
const game = (id: string, extra: Partial<HistoryMatch> = {}): HistoryMatch => ({
  match_id: id, match_date: '2026-10-09', created_at: '2026-10-09T12:00:00Z', my_team: 1,
  team1_score: 11, team2_score: 7, won: true, rating_change: 0.123456, rating_after: 4.1,
  partner_id: '', partner_name: '', opponent1_id: 'other', opponent1_name: 'Alex', opponent2_id: '', opponent2_name: '',
  court_name: 'Rally House', is_ranked: true, verified_by: [], registered_player_ids: ['me', 'other'], approval_player_ids: ['me', 'other'], ...extra,
});
let view: ReactTestRenderer, url: string;
function Location() { const location = useLocation(); url = location.pathname + location.search; return null; }
const mount = (path: string) => act(() => { view = create(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Location /><MatchHistory /></MemoryRouter>); });
beforeEach(() => mocks.history.mockReturnValue({ data: { matches: Array.from({ length: 35 }, (_, i) => game('match-' + i, { rr_event_id: 'event', source: 'round_robin', round_no: i + 1 })), pendingMatches: [game('pending')], playerName: 'Me' }, isPending: false, isError: false, isFetching: false, refetch: vi.fn() }));
afterEach(() => act(() => view?.unmount()));
it('opens an exact round-robin game beyond both list pagination and the collapsed group', () => {
  mount(matchHistoryPath('match-34'));
  expect(view.root.findAllByType('article').map(node => node.props['data-match-id'])).toEqual(['match-34']);
  expect(view.root.findAllByType('a').some(node => node.props.href === '/round-robin/event')).toBe(true);
});
it('finds pending games regardless of the history tab retained in the link', () => {
  mount('/player/matches?tab=verified&match=pending');
  expect(view.root.findAllByType('article').map(node => node.props['data-match-id'])).toEqual(['pending']);
  expect(view.root.findAllByType('button').some(node => node.children.join('') === 'Confirm score')).toBe(true);
});
it('explains missing records and lets the player return to their existing history tab', () => {
  mount('/player/matches?tab=pending&match=removed');
  expect(view.root.findAllByType('article')).toHaveLength(0);
  expect(JSON.stringify(view.toJSON())).toContain('This match isn’t available');
  act(() => view.root.findAllByType('button').find(node => node.children.join('') === 'View all matches')!.props.onClick());
  expect(url).toBe('/player/matches?tab=pending');
  expect(view.root.findAllByType('article').map(node => node.props['data-match-id'])).toEqual(['pending']);
});
it('does not expose another player’s pending match or verification controls', () => {
  mount('/player/matches?player=other&match=pending');
  expect(view.root.findAllByType('article')).toHaveLength(0);
});
it('encodes a match identifier without permitting additional query parameters', () => {
  expect(new URLSearchParams(matchHistoryPath('a&player=other').split('?')[1]).get('player')).toBeNull();
});
