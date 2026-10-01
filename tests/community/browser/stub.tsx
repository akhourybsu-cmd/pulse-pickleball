import { useState, useSyncExternalStore } from "react";
import { DEFAULT_GROUP_SETTINGS } from "../../../src/types/groupSettings";
export const scenario = new URLSearchParams(location.search).get("scenario");
const noop = () => {};
const asyncNoop = async () => true;
export const community = {
  id: "club",
  name:
    scenario === "long"
      ? "The North Shore Weekend Pickleball & Social Club"
      : "The Sunday Rally",
  description:
    "A little competition. A lot of good company. We’re a neighborhood crew that gets together for social doubles, weekend games and the occasional post-match coffee.",
  type: "crew",
  visibility: "public",
  join_method: "open",
  member_count: 48,
  icon_url: scenario === "photo" ? "/pulse-icon.jpg" : null,
  cover_url:
    scenario === "photo" ? "/venues/rally-haus/facility-preview.png" : null,
  invite_code: "LOCALONLY",
  venue: null,
  settings:
    scenario === "restricted"
      ? {
          allow_member_posts: false,
          allow_member_events: false,
          chat_enabled: false,
          files_enabled: false,
        }
      : {},
};
export const useAuthState = () => ({
  user: { id: "me" },
  profile: {
    display_name: "Alex",
    full_name: "Alex Player",
    first_name: "Alex",
    avatar_url: null,
  },
  loading: false,
});
export const useGroupDetail = () => ({
  group: community,
  membership: {
    role: "member",
    status: scenario === "pending" ? "pending" : "active",
    last_read_at: null,
  },
  loading: false,
  isError: false,
  refetch: asyncNoop,
});
export const useGroupSettings = () => ({
  settings: { ...DEFAULT_GROUP_SETTINGS, ...community.settings },
  loading: false,
});
export const useGroupPresence = () => ({
  onlineCount: 7,
  isConnected: true,
  isOnline: () => true,
});
export const useGroupRealtime = noop;
const stamp = new Date().toISOString();
const initialPosts = [
  {
    id: "post1",
    user_id: "jules",
    type: "feed",
    title: "Sunday plans are on.",
    content:
      "Courts at 9, coffee after. Bring a friend and we’ll sort teams when everyone arrives. All levels welcome!",
    pinned: true,
    profile: {
      full_name: "Jules Morgan",
      display_name: "Jules",
      avatar_url: null,
    },
  },
  {
    id: "post2",
    user_id: "sam",
    type: "poll",
    title: "What should we play next weekend?",
    content: "Pick your favorite and let’s make it happen.",
    poll_options: [
      { idx: 0, text: "Social doubles" },
      { idx: 1, text: "Round robin" },
      { idx: 2, text: "Skills & drills" },
    ],
    poll_vote_counts: [12, 9, 4],
    poll_my_vote: null,
    profile: { full_name: "Sam River", display_name: "Sam", avatar_url: null },
  },
  {
    id: "post3",
    user_id: "taylor",
    type: "feed",
    content:
      "Great games today. Thanks to everyone who made our new players feel welcome!",
    profile: {
      full_name: "Taylor Green",
      display_name: "Taylor",
      avatar_url: null,
    },
  },
].map((post) => ({
  ...post,
  group_id: "club",
  created_at: stamp,
  updated_at: stamp,
  last_activity_at: stamp,
  reactions: [{ emoji: "🔥", count: 4, hasReacted: false }],
  comment_count: 3,
}));
export const fetchGroupPosts = async () => initialPosts;
export function useGroupPosts() {
  const [posts, setPosts] = useState(scenario === "empty" ? [] : initialPosts);
  return {
    posts,
    loading: false,
    isError: scenario === "error",
    refetch: asyncNoop,
    createPost: async (data: object) => {
      setPosts((prev) => [
        ...prev,
        { ...initialPosts[0], ...data, id: "local-post", pinned: false },
      ]);
      return true;
    },
    deletePost: asyncNoop,
    toggleReaction: noop,
    togglePin: noop,
    joinLfgPost: asyncNoop,
    leaveLfgPost: asyncNoop,
    castPollVote: asyncNoop,
  };
}
const events = [
  {
    id: "event",
    group_id: "club",
    title: "Weekend social doubles",
    description: "Meet the crew for relaxed doubles. Everyone gets a game.",
    start_time: new Date(Date.now() + 86400000 * 3).toISOString(),
    end_time: new Date(Date.now() + 86400000 * 3 + 7200000).toISOString(),
    event_format: "open_play",
    location: "Neighborhood courts",
    created_by: "jules",
    capacity: 16,
    rsvps: { going: 12, maybe: 2, waitlist: 0, not_going: 0 },
    user_rsvp: null,
    waitlist_enabled: true,
    waitlist_limit: null,
    is_recurring: false,
  },
];
export const fetchGroupEvents = async () => events;
let visibleEvents = scenario === 'empty' ? [] : events;
const eventListeners = new Set<() => void>();
export const useGroupEvents = () => ({
  events: useSyncExternalStore(listener => { eventListeners.add(listener); return () => { eventListeners.delete(listener); }; }, () => visibleEvents),
  createEvent: async (data: Record<string, unknown>) => {
    if (scenario === 'saveerror') throw new Error('Local QA: save failed. Your draft is still here.');
    visibleEvents = [...visibleEvents, { ...events[0], ...data, id: crypto.randomUUID(), created_by: 'me', rsvps: { going: 0, maybe: 0, waitlist: 0, not_going: 0 }, is_recurring: !!data.recurring_rule }];
    eventListeners.forEach(listener => listener());
    return true;
  },
  loading: false,
  isError: scenario === "error",
  refetch: asyncNoop,
  deleteEvent: asyncNoop,
  updateRsvp: asyncNoop,
  updateEvent: asyncNoop,
});
const members = Array.from({ length: 48 }, (_, i) => ({
  id: `member-${i}`,
  user_id: `person-${i}`,
  group_id: "club",
  role: i === 0 ? "owner" : i === 1 ? "moderator" : "member",
  status: "active",
  joined_at: "2026-08-01T12:00:00Z",
  profile: {
    id: `person-${i}`,
    full_name:
      i === 47
        ? "Zoe Last"
        : `${["Jules Morgan", "Sam River", "Taylor Green", "Jordan Lee"][i % 4]} ${i + 1}`,
    display_name: null,
    avatar_url: null,
    current_rating: 3.5,
    gender: null,
  },
}));
export const useGroupMembers = () => ({
  members,
  pendingMembers: [],
  loading: false,
  isError: scenario === "error",
  refetch: asyncNoop,
  approveMember: asyncNoop,
  rejectMember: asyncNoop,
  updateRole: asyncNoop,
  removeMember: asyncNoop,
  banMember: asyncNoop,
});
export const useGroupFiles = () => ({
  files: [],
  loading: false,
  isError: scenario === "error",
  refetch: asyncNoop,
  uploading: false,
  uploadFile: asyncNoop,
  deleteFile: asyncNoop,
});
export const useFriends = () => ({
  sendFriendRequest: asyncNoop,
  getFriendshipStatus: () => "none",
  friends: [],
});
export const useDirectMessages = () => ({ startConversation: asyncNoop });
export const useGroupPostComments = () => ({
  comments: [],
  loading: false,
  creating: false,
  createComment: asyncNoop,
  deleteComment: asyncNoop,
  totalCount: 0,
});
const initialMessages = [
  {
    id: "m1",
    group_id: "club",
    user_id: "jules",
    content: "Who’s up for a game this Sunday?",
    created_at: stamp,
    updated_at: stamp,
    profile: {
      id: "jules",
      display_name: "Jules",
      full_name: "Jules Morgan",
      avatar_url: null,
    },
    reactions: [],
  },
];
export function useGroupChat() {
  const [messages, setMessages] = useState(initialMessages);
  return {
    messages,
    loading: false,
    isError: scenario === "error",
    refetch: asyncNoop,
    sending: false,
    hasOlder: false,
    loadingOlder: false,
    loadOlder: asyncNoop,
    sendMessage: async (content: string) => {
      setMessages((prev) => [
        ...prev,
        {
          ...initialMessages[0],
          id: crypto.randomUUID(),
          user_id: "me",
          content,
          profile: {
            id: "me",
            full_name: "Alex Player",
            display_name: "Alex",
            avatar_url: null,
          },
        },
      ]);
      return true;
    },
    retryMessage: asyncNoop,
    deleteMessage: asyncNoop,
    editMessage: asyncNoop,
    togglePinMessage: noop,
    toggleReaction: noop,
  };
}
export const useTypingIndicator = () => ({
  typingUsers: [],
  startTyping: noop,
  stopTyping: noop,
});
export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: "me" } }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
  },
  rpc: async () => ({ data: null, error: null }),
  from: () => {
    const query: Record<string, unknown> = {};
    for (const key of [
      "select",
      "eq",
      "in",
      "order",
      "limit",
      "update",
      "insert",
      "delete",
      "abortSignal",
    ])
      query[key] = () => query;
    query.then = (resolve: (value: unknown) => void) =>
      resolve({ data: [], error: null });
    query.maybeSingle = async () => ({ data: null, error: null });
    query.single = async () => ({ data: null, error: null });
    return query;
  },
  channel: () => ({
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
    unsubscribe: noop,
  }),
  removeChannel: noop,
};
