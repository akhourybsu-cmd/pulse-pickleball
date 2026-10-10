import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ hook: vi.fn(), mutate: vi.fn(), refetch: vi.fn(), more: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/useLeaguePosts', () => ({ useLeaguePosts: mocks.hook, LEAGUE_POST_LIMIT: 4000 }));
vi.mock('@/lib/leagues/data', () => ({ leagueErrorMessage: (error: Error) => error.message }));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
// Keep the feed's actual forms/cards, replacing only portal-based menu/dialog primitives.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: React.PropsWithChildren<{ onSelect: () => void }>) => <button type="button" onClick={onSelect}>{children}</button>,
}));
vi.mock('@/components/ui/alert-dialog', () => {
  const Box = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>;
  return { AlertDialog: ({ children, open }: React.PropsWithChildren<{ open: boolean }>) => open ? <div role="dialog">{children}</div> : null,
    AlertDialogContent: Box, AlertDialogHeader: Box, AlertDialogFooter: Box, AlertDialogTitle: Box,
    AlertDialogDescription: Box, AlertDialogCancel: Button, AlertDialogAction: Button };
});
import { LeagueFeed } from '@/components/leagues/LeagueFeed';
import type { LeaguePost } from '@/hooks/useLeaguePosts';
let view: ReactTestRenderer;
let state: Record<string, unknown>;
const update: LeaguePost = { id: 'post-1', league_id: 'league', author_id: 'manager', content: 'Courts open at 6 PM.', pinned: false, version: 1,
  created_at: '2026-10-01T18:00:00Z', updated_at: '2026-10-01T18:00:00Z', edited_at: null,
  author: { id: 'manager', display_name: 'Jamie Organizer', full_name: null, first_name: null, last_name: null, avatar_url: null } };
const contents = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : contents(child)).join('');
const button = (label: string) => view.root.findAllByType('button').find(node => contents(node) === label)!;
const draft = () => view.root.findByProps({ id: 'league-update-draft' });
const form = () => view.root.findAllByType('form')[0];
const render = (canManage = true, active = true) => <LeagueFeed leagueId="league" currentUserId="manager" canManage={canManage} active={active} />;
async function mount(canManage = true) { await act(async () => { view = create(render(canManage)); }); }
const typeDraft = (value: string) => act(() => draft().props.onChange({ target: { value } }));
const submit = async () => act(async () => { form().props.onSubmit({ preventDefault() {} }); });
beforeEach(() => {
  vi.clearAllMocks(); mocks.mutate.mockReset().mockResolvedValue(null);
  state = { posts: [update], isPending: false, isError: false, saving: false, hasNextPage: false,
    mutate: mocks.mutate, refetch: mocks.refetch, fetchNextPage: mocks.more };
  mocks.hook.mockImplementation(() => state);
});
afterEach(() => { act(() => view?.unmount()); });
it('gives members a readable feed without composer or moderation controls', async () => {
  await mount(false);
  expect(contents(view.root)).toContain('Courts open at 6 PM.');
  expect(contents(view.root)).toContain('Jamie Organizer');
  expect(view.root.findAllByType('textarea')).toHaveLength(0);
  expect(button('Edit update')).toBeUndefined(); expect(button('Delete update')).toBeUndefined();
});
it('prevents empty posts and clears a successful draft', async () => {
  await mount(); typeDraft('   '); await submit(); expect(mocks.mutate).not.toHaveBeenCalled();
  typeDraft('  Bring an extra ball.  '); await submit();
  expect(mocks.mutate).toHaveBeenCalledWith({ type: 'create', id: expect.any(String), content: 'Bring an extra ball.' });
  expect(draft().props.value).toBe(''); expect(mocks.success).toHaveBeenCalledWith('Update posted');
});
it('keeps a failed draft and reuses its ID when the response is lost', async () => {
  mocks.mutate.mockRejectedValueOnce(new Error('Connection interrupted. Please try again.'));
  await mount(); typeDraft('Schedule update'); await submit();
  expect(contents(view.root)).toContain('Connection interrupted. Please try again.');
  expect(draft().props.value).toBe('Schedule update');
  const first = mocks.mutate.mock.calls[0][0]; await submit();
  expect(mocks.mutate.mock.calls[1][0]).toEqual(first); expect(draft().props.value).toBe('');
});
it('blocks a rapid second submit while the first request is pending', async () => {
  let finish: (value: null) => void;
  mocks.mutate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount(); typeDraft('Rain delay');
  await act(async () => { form().props.onSubmit({ preventDefault() {} }); form().props.onSubmit({ preventDefault() {} }); });
  expect(mocks.mutate).toHaveBeenCalledTimes(1);
  await act(async () => { finish!(null); }); expect(draft().props.value).toBe('');
});
it('keeps an unfinished composer through tab changes and background refreshes', async () => {
  await mount(); typeDraft('Unfinished announcement');
  await act(async () => { view.update(render(true, false)); });
  state = { ...state, posts: [{ ...update, content: 'A newer update' }] };
  await act(async () => { view.update(render(true, true)); });
  expect(draft().props.value).toBe('Unfinished announcement'); expect(contents(view.root)).toContain('A newer update');
});
it('requires reviewing a newer version before saving an existing edit', async () => {
  await mount(); typeDraft('Separate new announcement');
  act(() => button('Edit update').props.onClick());
  act(() => view.root.findByProps({ id: 'edit-post-1' }).props.onChange({ target: { value: 'My unsaved edit' } }));
  state = { ...state, posts: [{ ...update, version: 2, content: 'Another organizer changed this', pinned: true }] };
  act(() => view.update(render()));
  expect(button('Save update').props.disabled).toBe(true);
  expect(view.root.findByProps({ id: 'edit-post-1' }).props.value).toBe('My unsaved edit');
  act(() => button('Replace draft with latest update').props.onClick());
  await act(async () => { view.root.findAllByType('form')[1].props.onSubmit({ preventDefault() {} }); });
  expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ type: 'update', content: 'Another organizer changed this', pinned: true, post: expect.objectContaining({ version: 2 }) }));
  expect(draft().props.value).toBe('Separate new announcement');
});
it('requires explicit confirmation before deleting a post', async () => {
  await mount(); act(() => button('Delete update').props.onClick()); expect(mocks.mutate).not.toHaveBeenCalled();
  const confirmation = view.root.findByProps({ role: 'dialog' }).findAllByType('button').find(node => contents(node) === 'Delete update')!;
  await act(async () => { confirmation.props.onClick({ preventDefault() {} }); });
  expect(mocks.mutate).toHaveBeenCalledWith({ type: 'delete', post: update });
  expect(view.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
});
it('distinguishes load failures from an empty feed and supports retry/pagination', async () => {
  state = { ...state, posts: [], isError: true }; await mount(false);
  expect(contents(view.root)).not.toContain('Your league updates start here');
  const retry = view.root.findAllByType('button')[0]; act(() => retry.props.onClick()); expect(mocks.refetch).toHaveBeenCalled();
  state = { ...state, posts: [update], isError: false, hasNextPage: true };
  act(() => view.update(render(false))); act(() => button('Load more updates').props.onClick()); expect(mocks.more).toHaveBeenCalled();
});
