import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScrollManager } from '@/components/ScrollManager';
let view: ReactTestRenderer, navigate: ReturnType<typeof useNavigate>;
let frames: Map<number, FrameRequestCallback>, nextFrame: number;
let browser: EventTarget & { scrollY: number; scrollTo: ReturnType<typeof vi.fn> };
function Harness() { navigate = useNavigate(); return <ScrollManager />; }
beforeEach(() => {
  frames = new Map(); nextFrame = 0;
  browser = Object.assign(new EventTarget(), { scrollY: 0, scrollTo: vi.fn((_x: number, y: number) => { browser.scrollY = y; }) });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++nextFrame, fn); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  act(() => { view = create(<MemoryRouter initialEntries={['/player/social']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Harness /></MemoryRouter>); });
  browser.scrollTo.mockClear();
});
afterEach(() => { act(() => view.unmount()); vi.unstubAllGlobals(); });
const frame = () => { const pending = [...frames.values()]; frames.clear(); act(() => pending.forEach(fn => fn(0))); };
it('keeps the reader in place while expanding the inbox', () => {
  browser.scrollY = 840;
  act(() => navigate('/player/social?shown=60', { replace: true, state: { preserveScroll: true } }));
  expect(browser.scrollTo).not.toHaveBeenCalled();
  expect(browser.scrollY).toBe(840);
});
it('restores an explicit league destination but does not carry that position to a different season', () => {
  const state = { restoreScrollY: 750, restoreScrollFor: '/player/leagues/a?season=autumn#standings' };
  act(() => navigate(state.restoreScrollFor, { replace: true, state }));
  frame(); expect(browser.scrollY).toBe(750);
  act(() => navigate('/player/leagues/a?season=summer#standings', { replace: true, state }));
  expect(browser.scrollY).toBe(0);
});
it('does not reset the page for a league hash-only tab change', () => {
  act(() => navigate('/player/leagues/a#standings', { replace: true }));
  browser.scrollTo.mockClear(); browser.scrollY = 240;
  act(() => navigate('/player/leagues/a#schedule', { replace: true }));
  expect(browser.scrollTo).not.toHaveBeenCalled();
});
it('uses the latest reading position on Back after a contextual return', () => {
  const destination = '/player/leagues/scroll-regression?season=fall#standings';
  act(() => navigate(destination, { replace: true, state: { restoreScrollY: 750, restoreScrollFor: destination } }));
  frame(); expect(browser.scrollY).toBe(750);
  browser.scrollY = 1200;
  browser.dispatchEvent(new Event('scroll')); frame();
  act(() => navigate('/player/groups/scroll-regression'));
  act(() => navigate(-1)); frame();
  expect(browser.scrollY).toBe(1200);
});
