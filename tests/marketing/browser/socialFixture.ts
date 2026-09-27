// Local screenshot data only. All page and shell components are production code.
// Reads resolve locally; writes fail, and this module never opens a connection.
import type { FriendWithProfile } from '../../../src/lib/social/friends';
import type { GroupWithMembership } from '../../../src/hooks/useGroups';
import type { DirectMessage } from '../../../src/hooks/useDirectMessages';

const noop = () => undefined;
const blocked = () => { throw new Error('Screenshot fixtures cannot write data.'); };
const date = '2026-09-23T14:00:00Z';
const user = { id: 'demo-0' };
const profile = {
  id: user.id, full_name: 'Alex Morgan', display_name: 'Alex Morgan',
  first_name: 'Alex', last_name: 'Morgan', name_locked: true,
  tutorial_completed: true, player_state: 'active', avatar_url: null,
  current_rating: 4.25, week_start_rating: 4.21, total_matches: 47,
  wins: 29, losses: 18, total_points_for: 420, total_points_against: 370,
  avg_opponent_rating: 4.1, town: 'Boston', state: 'Massachusetts',
};
const friends: FriendWithProfile[] = ['Jordan Lee', 'Sam Rivera', 'Taylor Chen', 'Casey Brooks'].map((name, index) => ({
  id: `friendship-${index}`, user_id: user.id, friend_id: `demo-${index + 1}`,
  status: 'accepted', created_at: date, accepted_at: date,
  profile: { id: `demo-${index + 1}`, full_name: name, display_name: name, avatar_url: null, current_rating: [4.1, 3.8, 4.0, 3.6][index], gender: null, handle: name.toLowerCase().replace(' ', '') },
}));
const onlineFriends = new Set(['demo-1', 'demo-2']);
const groups: GroupWithMembership[] = [
  { name: 'Saturday Court Crew', description: 'Good games and familiar faces. Saturdays at 9.', type: 'crew', member_count: 12 },
  { name: 'Riverside Open Play', description: 'Meet local players. Find your next game.', type: 'open_play', member_count: 36 },
  { name: 'Weeknight League', description: 'A new match. A shared season.', type: 'league', member_count: 24 },
].map((group, index) => ({
  ...group, type: group.type as GroupWithMembership['type'], id: `group-${index}`,
  visibility: 'public', join_method: 'open', invite_code: null, invite_code_expires_at: null,
  cover_url: null, icon_url: null, venue_id: null, court_id: null, created_by: user.id,
  settings: {}, created_at: date, updated_at: date, unread_count: index === 0 ? 2 : 0,
  membership: { id: `member-${index}`, group_id: `group-${index}`, user_id: user.id, role: 'member', status: 'active', last_read_at: date, joined_at: date },
}));
const messages: DirectMessage[] = [
  ['demo-1', 'Up for pickleball on Saturday?'],
  ['demo-0', 'Absolutely! Riverside at 9?'],
  ['demo-1', 'Perfect. Sam and Taylor are in too.'],
  ['demo-0', 'Great — doubles it is. I’ll bring the balls.'],
  ['demo-1', 'See you on court!'],
].map(([sender_id, content], index) => ({ id: `message-${index}`, conversation_id: 'demo-chat', sender_id, content, created_at: `2026-09-23T14:0${index}:00Z`, _status: 'sent' }));
const participant = { ...friends[0].profile, user_id: friends[0].profile.id };
const conversations = [{ id: 'demo-chat', updated_at: date, participant, lastMessage: messages[4], unreadCount: 0, isMuted: false, leftAt: null }];

export const useAuthState = () => ({ user, profile, loading: false, session: null, signOut: blocked, refreshProfile: noop });
export const useFriends = () => ({ friends, pendingRequests: [], sentRequests: [], loading: false, error: null, isPending: () => false, getFriendshipStatus: () => 'accepted', refetch: noop, acceptRequest: blocked, declineRequest: blocked, cancelRequest: blocked, removeFriend: blocked, sendFriendRequest: blocked });
export const useFriendsPresence = () => ({ onlineFriends, isConnected: true, isOnline: (id: string) => onlineFriends.has(id), onlineCount: onlineFriends.size });
export const useFriendSuggestions = () => ({ suggestions: [], loading: false, error: null, refetch: noop, dismissSuggestion: blocked });
export const useGroups = () => ({ myGroups: groups, publicGroups: groups, loading: false, createGroup: blocked, joinGroupByCode: blocked, joinPublicGroup: blocked, updateGroupOrder: blocked });
export const useDirectMessages = () => ({ conversations, loading: false, error: null, totalUnread: 0, currentUserId: user.id, startConversation: async () => 'demo-chat', markRead: async () => true, refetch: noop, setMuted: blocked, leaveConversation: blocked });
export const useConversation = () => ({ messages, loading: false, hasMore: false, loadingOlder: false, loadOlder: noop, participant, viewerMembership: { isMuted: false, leftAt: null }, currentUserId: user.id, notFound: false, sendMessage: blocked, retryMessage: blocked });
export const useTypingIndicator = () => ({ typingUsers: [], startTyping: noop, stopTyping: noop });
export const useBlockedUsers = () => ({ blockedUsers: [], loading: false, block: blocked, unblock: blocked });
export const reportUser = blocked;
export const useNotifications = () => ({ notifications: [], loading: false, unreadCount: 0, markAsRead: noop, markAllAsRead: noop, deleteNotification: blocked, clearAll: blocked, groupedByTime: {} });
export const usePushSubscription = () => ({ state: 'enabled', busy: false, supported: false, enable: blocked });
export const useMyLeagues = () => ({ rows: [], loading: false, error: null });
export const useMyUpcomingLeagueMatches = () => ({ rows: [], loading: false, error: null });
export const useUpcomingRegisteredEvents = () => ({ data: [], isLoading: false });
export const fetchUserRoundRobinEvents = async () => [{ event: { id: 'demo-rr', name: 'Saturday Court Crew', date: '2026-09-26', status: 'live', current_round: 2, num_rounds: 6, num_courts: 2, organizer_id: 'demo-2', voided: false }, role: 'player' }];

function query(table: string) {
  let single = false;
  const result = () => ({ data: table === 'profiles' || table === 'profiles_public' ? (single ? profile : [profile]) : single ? null : [], error: null, count: 0 });
  const chain = new Proxy({}, { get: (_target, property) => {
    if (property === 'then') return (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve);
    if (['insert', 'update', 'upsert', 'delete'].includes(String(property))) return blocked;
    if (property === 'single' || property === 'maybeSingle') return () => { single = true; return chain; };
    return () => chain;
  } });
  return chain;
}
const channel = { on: () => channel, subscribe: () => channel, unsubscribe: noop, untrack: noop, track: noop, presenceState: () => ({}) };
export const supabase = {
  auth: { getUser: async () => ({ data: { user } }), getSession: async () => ({ data: { session: { user } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }), signOut: blocked },
  from: query, channel: () => channel, removeChannel: noop, rpc: async () => ({ data: [], error: null }),
  functions: { invoke: blocked }, storage: { from: blocked },
};
