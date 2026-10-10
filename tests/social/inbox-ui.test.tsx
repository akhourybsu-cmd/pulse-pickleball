import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ inbox: vi.fn(), friends: vi.fn(), read: vi.fn(), mute: vi.fn(), leave: vi.fn(), refresh: vi.fn() }));
vi.mock('@/hooks/useSocialInbox', () => ({ useSocialInbox: mocks.inbox }));
vi.mock('@/hooks/useFriends', () => ({ useFriends: mocks.friends }));
vi.mock('@/lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('@/pages/player/Friends', () => ({ default: () => <div>Friends content</div> }));
vi.mock('@/components/messaging/MessageFriendPickerSheet', () => ({ MessageFriendPickerSheet: ({ open }: { open: boolean }) => open ? <div role="dialog">Choose a friend</div> : null }));
vi.mock('@/components/ui/avatar', () => ({ Avatar: ({ children }: React.PropsWithChildren) => <span>{children}</span>, AvatarImage: () => null, AvatarFallback: ({ children }: React.PropsWithChildren) => <span>{children}</span> }));
// Exercise the real inbox, rows and navigation, replacing DOM portal primitives only.
vi.mock('@/components/ui/dropdown-menu', () => {
  const Box = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return { DropdownMenu: Box, DropdownMenuTrigger: Box, DropdownMenuContent: Box, DropdownMenuSeparator: () => null,
    DropdownMenuItem: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button onClick={onClick} disabled={disabled}>{children}</button> };
});
vi.mock('@/components/ui/alert-dialog', () => {
  const Box = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>;
  return { AlertDialog: ({ children, open }: React.PropsWithChildren<{ open: boolean }>) => open ? <div role="dialog">{children}</div> : null,
    AlertDialogContent: Box, AlertDialogHeader: Box, AlertDialogFooter: Box, AlertDialogTitle: Box, AlertDialogDescription: Box,
    AlertDialogCancel: Button, AlertDialogAction: Button };
});
import Social from '@/pages/player/Social';
import type { SocialInboxState } from '@/hooks/useSocialInbox';
import type { SocialConversation } from '@/lib/social/inbox';
let view: ReactTestRenderer, state: SocialInboxState, navigate: NavigateFunction, url: string, routeState: unknown;
const contents = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : contents(child)).join('');
const button = (label: string) => view.root.findAllByType('button').find(node => contents(node).trim() === label)!;
const filter = (label: string) => view.root.findAllByType('button').find(node => node.props['aria-pressed'] !== undefined && contents(node).startsWith(label))!;
const search = () => view.root.findByType('input');
const rowButtons = () => view.root.findAllByType('button').filter(node => node.props['aria-label']?.startsWith('Open '));
function Location() { const location = useLocation(); url = location.pathname + location.search; routeState = location.state; navigate = useNavigate(); return null; }
const render = (path = '/player/social') => <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Location /><Routes>
  <Route path="/player/social" element={<Social />} /><Route path="/player/friends" element={<Social />} /><Route path="*" element={<div>Chat content</div>} />
</Routes></MemoryRouter>;
const mount = async (path?: string) => { await act(async () => { view = create(render(path)); }); };
const conversation = (id: string, type: 'dm' | 'group' = 'dm'): SocialConversation => ({ id, type, title: type === 'dm' ? 'Alex ' + id : 'Court crew', avatarUrl: null,
  lastActivityAt: '2026-10-01T12:00:00Z', lastMessagePreview: 'Court four at six?', unreadCount: type === 'dm' ? 100 : 0, isMuted: false,
  route: type === 'dm' ? '/player/messages/' + id : '/player/community/group/' + id + '?tab=chat' });
beforeEach(() => {
  vi.clearAllMocks(); mocks.leave.mockReset().mockResolvedValue(true);
  state = { conversations: [conversation('dm'), conversation('group', 'group')], loading: false, refreshing: false, error: null, currentUserId: 'player',
    markRead: mocks.read, setMuted: mocks.mute, leaveConversation: mocks.leave, refetch: mocks.refresh };
  mocks.inbox.mockImplementation(() => state); mocks.friends.mockReturnValue({ friends: [{ id: 'friend' }], pendingRequests: [{ id: 'request' }] });
});
afterEach(() => { act(() => view?.unmount()); });
it('keeps expanded inbox rows when returning from a conversation and resets them when filtering', async () => {
  state.conversations = Array.from({ length: 70 }, (_, i) => conversation(String(i)));
  await mount();
  expect(rowButtons()).toHaveLength(30);
  act(() => button('Load more conversations').props.onClick());
  expect(rowButtons()).toHaveLength(60);
  act(() => rowButtons()[59].props.onClick());
  expect(routeState).toMatchObject({ returnContext: { to: '/player/social?shown=60', label: 'Chats' } });
  act(() => navigate(-1));
  expect(rowButtons()).toHaveLength(60);
  act(() => filter('Unread').props.onClick());
  expect(rowButtons()).toHaveLength(30);
  expect(url).not.toContain('shown=');
});
it('filters by chat type and unread chats, combines search, and clears it accessibly', async () => {
  await mount(); expect(rowButtons()).toHaveLength(2); expect(contents(filter('Unread'))).toBe('Unread1');
  expect(rowButtons()[0].props['aria-label']).toContain('99+ unread messages');
  act(() => filter('Groups').props.onClick()); expect(rowButtons()).toHaveLength(1); expect(rowButtons()[0].props['aria-label']).toContain('Court crew');
  act(() => search().props.onChange({ target: { value: 'No match' } })); expect(contents(view.root)).toContain('No matching conversations');
  act(() => view.root.findAllByType('button').find(node => node.props['aria-label'] === 'Clear search')!.props.onClick());
  expect(search().props.value).toBe(''); expect(rowButtons()).toHaveLength(1);
  act(() => filter('Direct').props.onClick()); expect(rowButtons()).toHaveLength(1); expect(rowButtons()[0].props['aria-label']).toContain('Alex');
});
it('retains the inbox URL and filters after opening a chat and returning with Back', async () => {
  await mount('/player/social?filter=direct&q=alex');
  act(() => rowButtons()[0].props.onClick()); expect(url).toBe('/player/messages/dm'); expect(mocks.read).toHaveBeenCalledWith('dm');
  act(() => navigate(-1)); expect(search().props.value).toBe('alex'); expect(filter('Direct').props['aria-pressed']).toBe(true);
  act(() => filter('Groups').props.onClick()); act(() => search().props.onChange({ target: { value: '' } }));
  act(() => rowButtons()[0].props.onClick()); expect(url).toBe('/player/community/group/group?tab=chat'); expect(routeState).toMatchObject({ returnContext: { to: '/player/social?filter=groups', label: 'Chats' } });
});
it('preserves each view’s URL when moving between Chats and Friends', async () => {
  await mount('/player/social?filter=unread&q=alex');
  act(() => view.root.findAllByProps({ role: 'tab' }).find(node => contents(node).startsWith('Friends'))!.props.onClick());
  act(() => navigate('/player/friends?tab=requests'));
  act(() => button('Chats').props.onClick()); expect(url).toBe('/player/social?filter=unread&q=alex'); expect(rowButtons()).toHaveLength(1);
  act(() => view.root.findAllByProps({ role: 'tab' }).find(node => contents(node).startsWith('Friends'))!.props.onClick());
  expect(url).toBe('/player/friends?tab=requests');
});
it('retains rows during refresh/error, provides retry, and never disguises an initial error as an empty inbox', async () => {
  await mount(); state = { ...state, refreshing: true }; act(() => view.update(render()));
  expect(rowButtons()).toHaveLength(2); expect(view.root.findAllByProps({ 'aria-label': 'Loading conversations' })).toHaveLength(0);
  state = { ...state, refreshing: false, error: 'Offline' }; act(() => view.update(render()));
  expect(rowButtons()).toHaveLength(2); act(() => button('Retry').props.onClick()); expect(mocks.refresh).toHaveBeenCalled();
  state = { ...state, conversations: [] }; act(() => view.update(render()));
  expect(contents(view.root)).toContain("Couldn't load your chats"); expect(contents(view.root)).not.toContain('Your next game starts here');
});
it('renders long inboxes in batches without losing search access to older chats', async () => {
  state.conversations = Array.from({ length: 35 }, (_, i) => conversation(String(i)));
  await mount(); expect(rowButtons()).toHaveLength(30);
  act(() => button('Load more conversations').props.onClick()); expect(rowButtons()).toHaveLength(35);
  act(() => search().props.onChange({ target: { value: 'Alex 34' } })); expect(rowButtons()).toHaveLength(1);
  expect(rowButtons()[0].props['aria-label']).toContain('Alex 34');
});
it('requires leave confirmation, preserves failed actions for retry, and blocks double submission', async () => {
  await mount(); act(() => button('Leave conversation').props.onClick()); expect(mocks.leave).not.toHaveBeenCalled();
  const confirm = () => view.root.findByProps({ role: 'dialog' }).findAllByType('button').find(node => contents(node) === 'Leave conversation')!;
  mocks.leave.mockResolvedValueOnce(false);
  await act(async () => { confirm().props.onClick({ preventDefault() {} }); });
  expect(contents(view.root)).toContain("Couldn't leave this conversation");
  let finish: (value: boolean) => void;
  mocks.leave.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { confirm().props.onClick({ preventDefault() {} }); confirm().props.onClick({ preventDefault() {} }); });
  expect(mocks.leave).toHaveBeenCalledTimes(2);
  await act(async () => { finish!(true); }); expect(view.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
});
it('opens compose, friend requests, and player discovery from their intended controls', async () => {
  await mount(); act(() => view.root.findAllByType('button').find(node => contents(node).includes('New message'))!.props.onClick());
  expect(contents(view.root.findByProps({ role: 'dialog' }))).toContain('Choose a friend');
  act(() => button('1 friend request').props.onClick()); expect(url).toBe('/player/friends?tab=requests');
  act(() => navigate('/player/social')); act(() => view.root.findAllByType('button').find(node => contents(node).startsWith('Find players'))!.props.onClick());
  expect(url).toBe('/player/friends?connect=1');
});
