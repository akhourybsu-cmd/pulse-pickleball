import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCommunityTabs } from '@/hooks/useCommunityTabs';
import { useReturnNavigation } from '@/hooks/useReturnNavigation';
import { readReturnContext, returnContextState, returnHistoryDelta } from '@/lib/navigation/returnContext';

let view: ReactTestRenderer;
let location: ReturnType<typeof useLocation>;
let navigate: ReturnType<typeof useNavigate>;
let back: ReturnType<typeof useReturnNavigation>;
let tabs: ReturnType<typeof useCommunityTabs>;
function Harness() {
  location = useLocation(); navigate = useNavigate();
  back = useReturnNavigation(); tabs = useCommunityTabs(true);
  return null;
}
const mount = (path: string, state?: unknown) => act(() => {
  view = create(<MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? '?' + path.split('?')[1] : '', state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Harness /></MemoryRouter>);
});
afterEach(() => { act(() => view?.unmount()); vi.unstubAllGlobals(); });

describe('connected return journeys', () => {
  it('retains inbox search, filter and expanded list across community tab changes', () => {
    mount('/player/social?filter=groups&q=rally&shown=60');
    const origin = returnContextState(location, 'Chats');
    act(() => navigate('/player/community/group/rally?tab=chat', { state: origin }));
    act(() => tabs.handleTabChange('members'));
    act(() => tabs.handleTabChange('feed'));
    expect(back.label).toBe('Chats');
    act(() => back.goBack());
    expect(location.pathname + location.search).toBe('/player/social?filter=groups&q=rally&shown=60');
  });
  it('returns to the original league season and tab, with a scroll fallback when history is unavailable', () => {
    const state = returnContextState({ pathname: '/player/leagues/ladder', search: '?season=autumn', hash: '#standings' }, 'League');
    state.returnContext.scrollY = 750;
    mount('/player/community/group/rally', state);
    act(() => tabs.handleTabChange('chat'));
    act(() => back.goBack());
    expect(location.pathname + location.search + location.hash).toBe('/player/leagues/ladder?season=autumn#standings');
    expect(location.state).toEqual({ restoreScrollY: 750, restoreScrollFor: '/player/leagues/ladder?season=autumn#standings' });
  });
  it('pops all intermediate community tabs when the original browser entry is available', () => {
    const history = { state: { idx: 4 } };
    vi.stubGlobal('window', { history, scrollY: 300 });
    mount('/player/social?q=alex');
    const source = returnContextState(location, 'Chats');
    act(() => navigate('/player/community/group/rally?tab=chat', { state: source }));
    act(() => tabs.handleTabChange('members'));
    history.state.idx = 6;
    act(() => back.goBack());
    expect(location.pathname + location.search).toBe('/player/social?q=alex');
    // Forward still visits the chat: Back did not replace or duplicate the inbox.
    act(() => navigate(1));
    expect(location.pathname + location.search).toBe('/player/community/group/rally?tab=chat');
  });
  it('uses a safe destination for a directly opened community', () => {
    mount('/player/community/group/rally?tab=chat');
    act(() => back.goBack());
    expect(location.pathname).toBe('/player/community');
  });
  it.each(['https://example.com', '//example.com', '/auth', '/player/social\\evil', '/player/social\n'])('rejects an invalid return target %s', to => {
    expect(readReturnContext({ returnContext: { to, label: 'Chats' } })).toBeNull();
  });
  it('never navigates forward or uses an invalid history index as Back', () => {
    const context = { to: '/player/social', label: 'Chats', scrollY: 0, historyIndex: 4 };
    expect(returnHistoryDelta(context, 4)).toBeNull();
    expect(returnHistoryDelta(context, 2)).toBeNull();
    expect(returnHistoryDelta(context, undefined)).toBeNull();
    expect(readReturnContext({ returnContext: { ...context, historyIndex: -2 } })?.historyIndex).toBeUndefined();
  });
});
