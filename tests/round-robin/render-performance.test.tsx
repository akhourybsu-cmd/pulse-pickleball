import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScheduleRoundCarousel } from '@/components/round-robin/ScheduleRoundCarousel';
import { CourtsRoundsDialog } from '@/components/round-robin/CourtsRoundsDialog';
import { NumericStepper } from '@/components/round-robin/NumericStepper';

const carousel = vi.hoisted(() => {
  const handlers = new Map<string, Set<() => void>>();
  let selected = 0;
  const emit = (name: string) => handlers.get(name)?.forEach(fn => fn());
  const api = {
    selectedScrollSnap: () => selected,
    on: (name: string, fn: () => void) => { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name)!.add(fn); },
    off: (name: string, fn: () => void) => handlers.get(name)?.delete(fn),
    scrollTo: (index: number) => { selected = index; emit('select'); },
    scrollPrev: () => { selected--; emit('select'); },
    scrollNext: () => { selected++; emit('select'); },
  };
  return { api, handlers, emit };
});
vi.mock('@/components/ui/carousel', () => ({
  Carousel: ({ setApi, children }: { setApi: (api: unknown) => void; children: React.ReactNode }) => {
    React.useEffect(() => { setApi(carousel.api); }, [setApi]);
    return <div>{children}</div>;
  },
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <section {...props}>{children}</section>,
}));
vi.mock('framer-motion', () => ({
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  useReducedMotion: () => true,
}));
vi.mock('@/components/round-robin/ResponsiveSettingsModal', () => ({
  ResponsiveSettingsModal: ({ open, children, footer }: { open: boolean; children: React.ReactNode; footer: React.ReactNode }) => open ? <div>{children}{footer}</div> : null,
  ModalActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
let root: ReactTestRenderer;
beforeEach(() => { carousel.handlers.clear(); carousel.api.scrollTo(0); });
afterEach(() => act(() => root?.unmount()));

it('mounts only nearby round cards, keeps every swipe target, and reaches every round', () => {
  const renderRound = vi.fn((round: number) => <div data-round={round}>Round {round}</div>);
  act(() => { root = create(<ScheduleRoundCarousel totalRounds={20} currentRound={10}>{renderRound}</ScheduleRoundCarousel>); });
  expect(root.root.findAllByType('section')).toHaveLength(20);
  for (let round = 1; round <= 20; round++) {
    act(() => carousel.api.scrollTo(round - 1));
    const mounted = root.root.findAll(node => node.props['data-round']);
    expect(mounted.length).toBeLessThanOrEqual(3);
    expect(mounted.some(node => node.props['data-round'] === round)).toBe(true);
    const active = root.root.findAllByType('section').filter(node => !node.props['aria-hidden']);
    expect(active).toHaveLength(1);
    expect(active[0].props['aria-label']).toBe(`Round ${round}`);
  }
});

it('follows an advanced current round and clamps selection when a rebuild removes rounds', () => {
  const renderRound = (round: number) => <div data-round={round} />;
  act(() => { root = create(<ScheduleRoundCarousel totalRounds={20} currentRound={2}>{renderRound}</ScheduleRoundCarousel>); });
  act(() => root.update(<ScheduleRoundCarousel totalRounds={20} currentRound={3}>{renderRound}</ScheduleRoundCarousel>));
  expect(carousel.api.selectedScrollSnap()).toBe(2);
  act(() => carousel.api.scrollTo(19));
  act(() => root.update(<ScheduleRoundCarousel totalRounds={5} currentRound={3}>{renderRound}</ScheduleRoundCarousel>));
  expect(root.root.findAllByType('section').filter(node => !node.props['aria-hidden'])[0].props['aria-label']).toBe('Round 5');
  act(() => { carousel.api.scrollTo(4); carousel.emit('reInit'); });
  expect(root.root.findAllByType('section')).toHaveLength(5);
});

it('preserves parent-owned score drafts when distant round cards unmount', () => {
  function Draft() {
    const [scores, setScores] = useState<Record<number, string>>({});
    return <ScheduleRoundCarousel totalRounds={20}>{round => <input aria-label={`Score ${round}`} value={scores[round] ?? ''} onChange={e => setScores({ ...scores, [round]: e.target.value })} />}</ScheduleRoundCarousel>;
  }
  act(() => { root = create(<Draft />); });
  act(() => root.root.findByProps({ 'aria-label': 'Score 1' }).props.onChange({ target: { value: '11' } }));
  act(() => carousel.api.scrollTo(19));
  expect(root.root.findAllByProps({ 'aria-label': 'Score 1' })).toHaveLength(0);
  act(() => carousel.api.scrollTo(0));
  expect(root.root.findByProps({ 'aria-label': 'Score 1' }).props.value).toBe('11');
});

it('navigates actual saved round numbers without creating phantom rounds', () => {
  act(() => { root = create(<ScheduleRoundCarousel totalRounds={3} roundNumbers={[1, 4, 7]} currentRound={4}>{round => <div data-round={round} />}</ScheduleRoundCarousel>); });
  const sections = root.root.findAllByType('section');
  expect(sections.map(node => node.props['aria-label'])).toEqual(['Round 1', 'Round 4', 'Round 7']);
  expect(sections.filter(node => !node.props['aria-hidden'])[0].props['aria-label']).toBe('Round 4');
  act(() => root.root.findByProps({ 'aria-label': 'Choose round' }).props.onChange({ target: { value: '7' } }));
  expect(carousel.api.selectedScrollSnap()).toBe(2);
  expect(root.root.findAllByType('section').filter(node => !node.props['aria-hidden'])[0].props['aria-label']).toBe('Round 7');
});

it('does no schedule planning for a closed settings menu or unrelated renders, but replans changed settings', () => {
  const plan = vi.fn(() => null);
  const props = { onOpenChange: vi.fn(), currentCourts: 4, currentGamesPerPlayer: 6, currentRound: 3,
    hasScores: true, hasSchedule: true, totalPlayers: 18, getImpactPlan: plan, onApply: vi.fn() };
  act(() => { root = create(<CourtsRoundsDialog {...props} open={false} />); });
  act(() => root.update(<CourtsRoundsDialog {...props} open={false} currentRound={4} />));
  expect(plan).not.toHaveBeenCalled();
  act(() => root.update(<CourtsRoundsDialog {...props} open />));
  expect(plan).toHaveBeenCalledTimes(1);
  act(() => root.update(<CourtsRoundsDialog {...props} open currentRound={4} />));
  expect(plan).toHaveBeenCalledTimes(1);
  act(() => root.root.findAllByType(NumericStepper)[0].props.onChange(3));
  expect(plan).toHaveBeenLastCalledWith({ numCourts: 3, gamesPerPlayer: 6, equalGames: false });
  expect(plan).toHaveBeenCalledTimes(2);
  act(() => root.update(<CourtsRoundsDialog {...props} open={false} />));
  expect(plan).toHaveBeenCalledTimes(2);
});
