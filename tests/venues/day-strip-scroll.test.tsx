import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { DayStrip } from '@/components/venue/DayStrip';

const state = vi.hoisted(() => ({ refs: [] as unknown[], effects: [] as (() => void)[] }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: () => ({ current: state.refs.shift() }),
  useEffect: (effect: () => void) => { state.effects.push(effect); },
}));

it('centers the chosen date using only horizontal strip scrolling', () => {
  const scrollTo = vi.fn();
  const scrollIntoView = vi.fn();
  state.refs = [
    { scrollLeft: 40, clientWidth: 300, scrollTo, getBoundingClientRect: () => ({ left: 100 }) },
    { offsetWidth: 80, scrollIntoView, getBoundingClientRect: () => ({ left: 300 }) },
  ];
  state.effects = [];
  renderToStaticMarkup(<DayStrip value={new Date()} onChange={() => {}} />);
  for (const effect of state.effects) effect();
  expect(scrollTo).toHaveBeenCalledWith({ left: 130 });
  expect(scrollIntoView).not.toHaveBeenCalled();
});
