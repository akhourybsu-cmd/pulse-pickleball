/**
 * Presentation-layer view model for the unified Social inbox.
 *
 * Direct messages and group chats are stored and fetched separately (different
 * tables/hooks); these pure helpers normalize both into one `SocialConversation`
 * shape so the inbox can render + sort + filter them together. This is
 * presentation-only — it never becomes a source of truth and does not change
 * any backend behavior.
 */

export type ConversationType = "dm" | "group";

export interface SocialConversation {
  id: string;
  type: ConversationType;
  title: string;
  avatarUrl: string | null;
  /** One-line preview of the latest message (already sender-prefixed for groups). */
  lastMessagePreview: string | null;
  /** ISO timestamp used for chronological ordering. */
  lastActivityAt: string;
  unreadCount: number;
  isMuted: boolean;
  /** Group member count (groups only). */
  participantCount?: number;
  /** Where tapping the row navigates. */
  route: string;
  /** For groups: the Community group id, for a secondary "View group" action. */
  relatedCommunityId?: string;
}

/** Minimal shape of a DM conversation preview (subset of ConversationPreview). */
export interface DmSource {
  id: string;
  updated_at: string;
  participant: { display_name: string | null; full_name: string | null; avatar_url: string | null };
  lastMessage: { content: string; sender_id: string; created_at: string } | null;
  unreadCount: number;
  isMuted: boolean;
}

/** Minimal shape of a group + its latest chat message. */
export interface GroupSource {
  id: string;
  name: string;
  icon_url: string | null;
  member_count: number;
  updated_at: string;
  unread_count?: number;
}
export interface GroupLatestMessage {
  content: string;
  image_url: string | null;
  created_at: string;
  senderName: string | null;
  senderIsMe: boolean;
}

const dmName = (p: DmSource["participant"]) => p.display_name || p.full_name || "Player";

/** Human preview for a message body, handling empty / attachment-only cases. */
export function messagePreview(content: string | null | undefined, hasImage = false): string {
  const text = (content ?? "").trim();
  if (text) return text;
  if (hasImage) return "📷 Photo";
  return "";
}

export function dmToConversation(c: DmSource, currentUserId: string | null): SocialConversation {
  const lastFromMe = !!c.lastMessage && c.lastMessage.sender_id === currentUserId;
  const body = messagePreview(c.lastMessage?.content);
  const preview = c.lastMessage
    ? (body ? (lastFromMe ? `You: ${body}` : body) : null)
    : null;
  return {
    id: c.id,
    type: "dm",
    title: dmName(c.participant),
    avatarUrl: c.participant.avatar_url,
    lastMessagePreview: preview,
    lastActivityAt: c.lastMessage?.created_at ?? c.updated_at,
    unreadCount: c.unreadCount,
    isMuted: c.isMuted,
    route: `/player/messages/${c.id}`,
  };
}

export function groupToConversation(
  g: GroupSource,
  latest?: GroupLatestMessage | null,
  /**
   * Unread CHAT messages for this group. The inbox is a chat surface, so
   * the badge must reflect unread group-chat messages — NOT the group's
   * `unread_count`, which counts new community-feed posts. Callers that
   * don't compute chat-unread fall back to `g.unread_count` for back-compat.
   */
  chatUnread?: number,
): SocialConversation {
  const body = latest ? messagePreview(latest.content, !!latest.image_url) : "";
  let preview: string | null = null;
  if (latest && body) {
    const who = latest.senderIsMe ? "You" : (latest.senderName || null);
    preview = who ? `${who}: ${body}` : body;
  }
  return {
    id: g.id,
    type: "group",
    title: g.name,
    avatarUrl: g.icon_url,
    lastMessagePreview: preview,
    lastActivityAt: latest?.created_at ?? g.updated_at,
    unreadCount: chatUnread ?? g.unread_count ?? 0,
    isMuted: false,
    participantCount: g.member_count,
    route: `/player/community/group/${g.id}?tab=chat`,
    relatedCommunityId: g.id,
  };
}

/** Newest activity first; stable on ties by id so ordering never jitters. */
export function sortConversations(list: SocialConversation[]): SocialConversation[] {
  return [...list].sort((a, b) => {
    const t = new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });
}

export type InboxFilter = "all" | "unread" | "muted";

/** Apply the active filter + a case-insensitive title/preview search. */
export function filterConversations(
  list: SocialConversation[],
  filter: InboxFilter,
  query: string,
): SocialConversation[] {
  let out = list;
  if (filter === "unread") out = out.filter((c) => c.unreadCount > 0);
  else if (filter === "muted") out = out.filter((c) => c.isMuted);
  const q = query.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? "").toLowerCase().includes(q),
    );
  }
  return out;
}

/** Total unread across a conversation list (for a combined badge). */
export function totalUnread(list: SocialConversation[]): number {
  return list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}
