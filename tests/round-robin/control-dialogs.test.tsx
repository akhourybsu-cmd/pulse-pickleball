import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { EditEventDialog } from '@/components/round-robin/EditEventDialog';
import { CourtsRoundsDialog } from '@/components/round-robin/CourtsRoundsDialog';
import { ScheduleEditorDialog } from '@/components/round-robin/ScheduleEditorDialog';
import { NumericStepper } from '@/components/round-robin/NumericStepper';
import { PlayerEventBriefing } from '@/components/round-robin/PlayerEventBriefing';
import { resolvedMatchLabel } from '@/lib/roundRobin/standings';

vi.mock('@/components/round-robin/ResponsiveSettingsModal', () => ({
  ResponsiveSettingsModal: ({ open, children, footer, onOpenChange }: { open: boolean; children: React.ReactNode; footer: React.ReactNode; onOpenChange: (open: boolean) => void }) => open ? <div><button onClick={() => onOpenChange(false)}>Dismiss sheet</button>{children}{footer}</div> : null,
  ModalActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
let root: ReactTestRenderer;
afterEach(() => { act(() => root?.unmount()); vi.unstubAllEnvs(); });
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(text).join('');
const button = (label: string) => root.root.findAllByType('button').find(node => text(node) === label)!;
const event = { id: 'event', name: 'Friday social', date: '2026-10-04', start_time: '09:00', notes: '', rating_eligible: true, rating_type: 'league' as const, num_courts: 2, num_rounds: 3, max_players: 8, registration_mode: 'open_registration', registration_deadline: '2026-10-04T13:00:00Z' };

it('shows deadlines in local time, does not change them on another edit, and allows clearing them', async () => {
  vi.stubEnv('TZ', 'America/New_York');
  const save = vi.fn().mockResolvedValue(undefined);
  await act(async () => { root = create(<EditEventDialog open event={event} onOpenChange={vi.fn()} onSave={save} />); });
  expect(root.root.findByProps({ id: 'registration-deadline' }).props.value).toBe('2026-10-04T09:00');
  await act(async () => root.root.findByProps({ id: 'name' }).props.onChange({ target: { value: 'Friday doubles' } }));
  await act(async () => button('Save changes').props.onClick());
  expect(save).toHaveBeenLastCalledWith({ name: 'Friday doubles' });
  await act(async () => root.root.findByProps({ id: 'registration-deadline' }).props.onChange({ target: { value: '' } }));
  await act(async () => button('Save changes').props.onClick());
  expect(save).toHaveBeenLastCalledWith({ name: 'Friday doubles', registration_deadline: null });
});
it('preserves settings on refresh and failed save, reports the failure and allows retry', async () => {
  const close = vi.fn(); const save = vi.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValue(undefined);
  await act(async () => { root = create(<EditEventDialog open event={event} onOpenChange={close} onSave={save} />); });
  await act(async () => root.root.findByProps({ id: 'name' }).props.onChange({ target: { value: 'Keep my edit' } }));
  await act(async () => root.update(<EditEventDialog open event={{ ...event }} onOpenChange={close} onSave={save} />));
  expect(root.root.findByProps({ id: 'name' }).props.value).toBe('Keep my edit');
  await act(async () => button('Save changes').props.onClick());
  expect(close).not.toHaveBeenCalled();
  expect(root.root.findByProps({ role: 'alert' }).children).toContain('Connection interrupted');
  expect(root.root.findByProps({ id: 'name' }).props.value).toBe('Keep my edit');
  await act(async () => button('Save changes').props.onClick());
  expect(close).toHaveBeenCalledWith(false);
});
it('blocks duplicate settings submissions and closing while the save is pending', async () => {
  let finish!: () => void;
  const close = vi.fn(); const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  await act(async () => { root = create(<EditEventDialog open event={event} onOpenChange={close} onSave={save} />); });
  await act(async () => root.root.findByProps({ id: 'name' }).props.onChange({ target: { value: 'Updated name' } }));
  const submit = button('Save changes').props.onClick;
  let pending!: Promise<void>;
  await act(async () => { pending = submit(); void submit(); });
  await act(async () => button('Dismiss sheet').props.onClick());
  expect(save).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
  expect(button('Cancel').props.disabled).toBe(true);
  await act(async () => { finish(); await pending; });
  expect(close).toHaveBeenCalledWith(false);
});
it('keeps a stale settings draft from overwriting a concurrent host change', async () => {
  const save = vi.fn(); const close = vi.fn();
  await act(async () => { root = create(<EditEventDialog open event={{ ...event, schedule_version: 0 }} onSave={save} onOpenChange={close} />); });
  await act(async () => root.root.findByProps({ id: 'name' }).props.onChange({ target: { value: 'Unsaved name' } }));
  await act(async () => root.update(<EditEventDialog open event={{ ...event, schedule_version: 1, notes: 'Another host updated these notes' }} onSave={save} onOpenChange={close} />));
  await act(async () => button('Save changes').props.onClick());
  expect(save).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  expect(text(root.root.findByProps({ role: 'alert' }))).toContain('changed elsewhere');
  expect(root.root.findByProps({ id: 'name' }).props.value).toBe('Unsaved name');
});
it('keeps a failed courts/games change visible for retry without an unhandled rejection', async () => {
  const close = vi.fn(); const apply = vi.fn().mockRejectedValueOnce(new Error('Schedule changed elsewhere')).mockResolvedValue(undefined);
  const props = { open: true, onOpenChange: close, currentCourts: 2, currentGamesPerPlayer: 3, currentRound: 1, hasScores: false, hasSchedule: false, totalPlayers: 0, onApply: apply };
  await act(async () => { root = create(<CourtsRoundsDialog {...props} />); });
  await act(async () => root.root.findAllByType(NumericStepper)[0].props.onChange(3));
  await act(async () => button('Save setup').props.onClick());
  expect(close).not.toHaveBeenCalled();
  expect(text(root.root.findByProps({ role: 'alert' }))).toContain('Schedule changed');
  expect(root.root.findAllByType(NumericStepper)[0].props.value).toBe(3);
  await act(async () => button('Save setup').props.onClick());
  expect(close).toHaveBeenCalledWith(false);
});
const matches = [1, 2].map(court => ({ id: `match-${court}`, round_no: 2, court_no: court, a1_player_id: `a${court}`, a2_player_id: `b${court}`, b1_player_id: `c${court}`, b2_player_id: `d${court}`, is_bye: false, team1_score: null, team2_score: null }));
it('preserves manual schedule selection on equivalent refresh, exposes failures, and retries', async () => {
  const rotate = vi.fn().mockRejectedValueOnce(new Error('Refresh and review this schedule')).mockResolvedValue(undefined);
  const props = { open: true, onOpenChange: vi.fn(), schedule: matches, currentRound: 1, eventStatus: 'live' as const, numCourts: 2, getPlayerName: (id: string | null) => id ?? '', onRotatePartners: rotate, onSwapOpponents: vi.fn(), onMoveCourt: vi.fn() };
  await act(async () => { root = create(<ScheduleEditorDialog {...props} />); });
  const round = root.root.findAllByType('button').find(node => text(node).includes('Round 2'))!;
  await act(async () => round.props.onClick());
  await act(async () => root.root.findAllByType('button').find(node => text(node).startsWith('Rotate partners'))!.props.onClick());
  await act(async () => root.root.findAllByType('button').find(node => node.props['aria-label']?.startsWith('Court 1:'))!.props.onClick());
  await act(async () => root.update(<ScheduleEditorDialog {...props} schedule={matches.map(match => ({ ...match }))} />));
  expect(button('Rotate partners').props.disabled).toBe(false);
  await act(async () => button('Rotate partners').props.onClick());
  expect(rotate).toHaveBeenCalledWith('match-1');
  expect(text(root.root.findByProps({ role: 'alert' }))).toContain('Refresh and review');
  await act(async () => button('Rotate partners').props.onClick());
  expect(rotate).toHaveBeenCalledTimes(2);
});
it('explains resolved courts to players without telling them to play a removed result', async () => {
  const label = resolvedMatchLabel({ abandoned: true, abandoned_reason: 'Result voided by host' });
  await act(async () => { root = create(<PlayerEventBriefing status="live" round={1} totalRounds={3} court={2} resolvedLabel={label} next={{ round: 2, court: 1 }} onExplore={vi.fn()} />); });
  expect(text(root.root)).toContain('Result voided');
  expect(text(root.root)).toContain('Round 2 · Court 1');
  expect(text(root.root)).not.toContain('Head to your court');
  expect(root.root.findAllByProps({ 'aria-label': 'Your matchup' })).toHaveLength(0);
});
it('uses distinct labels for voided, deleted and abandoned results', () => {
  expect(resolvedMatchLabel({ abandoned: true, abandoned_reason: 'Result deleted by administrator' })).toBe('Result removed');
  expect(resolvedMatchLabel({ abandoned: true, abandoned_reason: 'Player departure' })).toBe('Abandoned');
  expect(resolvedMatchLabel({ abandoned: false })).toBeNull();
});
