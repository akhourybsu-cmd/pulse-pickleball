import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ conversation: 'chat-a', user: 'alice', navigate: vi.fn(), write: vi.fn(), from: vi.fn(),
  loadError: false, participant: true, refetch: vi.fn(), privacyError: false, privacyRetry: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ conversationId: mocks.conversation }), useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/useReturnNavigation', () => ({ useReturnNavigation: () => ({ goBack: mocks.navigate }) }));
vi.mock('@/hooks/useDirectMessages', () => ({ useConversation: () => ({ messages: [], loading: false, hasMore: false,
  currentUserId: mocks.user, participant: mocks.participant ? { id: mocks.conversation, display_name: 'Friend' } : null,
  viewerMembership: null, loadError: mocks.loadError, refetch: mocks.refetch }), useDirectMessages: () => ({ markRead: vi.fn() }) }));
vi.mock('@/hooks/useConversationRestriction', () => ({ useConversationRestriction: () => ({ data: null, isPending: false, isError: mocks.privacyError, refetch: mocks.privacyRetry }) }));
vi.mock('@/hooks/useTypingIndicator', () => ({ useTypingIndicator: () => ({ typingUsers: [], startTyping: vi.fn(), stopTyping: vi.fn() }) }));
vi.mock('@/hooks/useMessagingSafety', () => ({ useBlockedUsers: () => ({ block: vi.fn() }), reportUser: vi.fn() }));
vi.mock('@/contexts/ActiveViewContext', () => ({ useRegisterActiveContext: () => {} }));
vi.mock('@/hooks/useVisualViewportPane', () => ({ useVisualViewportPane: () => ({}) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/community/MessageComposer', () => ({ MessageComposer: ({ disabled }: { disabled: boolean }) => <textarea disabled={disabled} /> }));
vi.mock('@/components/ui/avatar', () => ({ Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>, AvatarFallback: ({ children }: React.PropsWithChildren) => <span>{children}</span>, AvatarImage: () => null }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: React.PropsWithChildren<{ onClick: () => void }>) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => null,
}));
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogCancel: () => null,
  AlertDialogAction: ({ children, onClick }: React.PropsWithChildren<{ onClick: () => void }>) => <button onClick={onClick}>{children}</button>,
}));
vi.mock('@/components/ui/dialog', () => ({ Dialog: () => null, DialogContent: () => null, DialogDescription: () => null,
  DialogFooter: () => null, DialogHeader: () => null, DialogTitle: () => null }));
import DirectMessageChat from '@/pages/player/DirectMessageChat';
let view: ReactTestRenderer;
const render = async () => { await act(async () => { if (view) view.update(<DirectMessageChat />); else view = create(<DirectMessageChat />); }); };
const button = (label: string) => view.root.findAllByType('button').find(node => node.children.includes(label))!;
beforeEach(() => {
  view = undefined as unknown as ReactTestRenderer; mocks.conversation = 'chat-a'; mocks.user = 'alice';
  mocks.loadError = false; mocks.participant = true; mocks.privacyError = false; vi.clearAllMocks();
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  mocks.write.mockReset().mockResolvedValue({ error: null });
  mocks.from.mockImplementation(() => {
    let updating = false;
    const q = { select: () => q, eq: () => q, maybeSingle: () => q, abortSignal: () => q,
      update: () => { updating = true; return q; },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (updating ? mocks.write() : Promise.resolve({ data: null })).then(resolve, reject) };
    return q;
  });
});
afterEach(() => { act(() => view?.unmount()); vi.unstubAllGlobals(); });
it('coalesces repeated mute taps and ignores a failed response after changing chats', async () => {
  let finish!: (value: unknown) => void;
  mocks.write.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await render();
  const mute = button('Mute notifications').props.onClick;
  await act(async () => { void mute(); void mute(); }); expect(mocks.write).toHaveBeenCalledTimes(1);
  mocks.conversation = 'chat-b'; await render();
  await act(async () => { await button('Mute notifications').props.onClick(); });
  await act(async () => { finish({ error: new Error('Offline') }); });
  expect(button('Unmute notifications')).toBeDefined();
});
it('does not navigate away from a new chat when leaving the previous one completes', async () => {
  let finish!: (value: unknown) => void;
  mocks.write.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await render();
  await act(async () => { void button('Leave').props.onClick(); });
  mocks.conversation = 'chat-b'; await render();
  await act(async () => { finish({ error: null }); }); expect(mocks.navigate).not.toHaveBeenCalled();
});
it('offers an initial-load retry and disables sending when privacy settings fail', async () => {
  mocks.participant = false; mocks.loadError = true; await render();
  expect(JSON.stringify(view.toJSON())).toContain("Conversation couldn't load");
  await act(async () => { button('Try again').props.onClick(); }); expect(mocks.refetch).toHaveBeenCalled();
  mocks.participant = true; mocks.loadError = false; mocks.privacyError = true; await render();
  expect(view.root.findByType('textarea').props.disabled).toBe(true);
  await act(async () => { button('Try again').props.onClick(); }); expect(mocks.privacyRetry).toHaveBeenCalled();
});
