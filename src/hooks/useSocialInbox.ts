import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useGroups } from "@/hooks/useGroups";
import {
  dmToConversation,
  groupToConversation,
  sortConversations,
  type SocialConversation,
  type GroupLatestMessage,
} from "@/lib/social/inbox";

/**
 * Unified Social inbox — direct messages + group chats normalized into one
 * chronological conversation list (presentation-only). DMs come from
 * useDirectMessages (with realtime); group chats come from useGroups plus a
 * single batched fetch of each group's latest message for the preview + last
 * activity time. No backend changes; the DM mutations (markRead/mute/leave)
 * are re-exposed so rows keep their existing behavior.
 */

interface RawLatest {
  content: string;
  image_url: string | null;
  created_at: string;
  senderId: string;
  senderName: string | null;
}

export interface SocialInboxState {
  conversations: SocialConversation[];
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  markRead: (conversationId: string) => void;
  setMuted: (conversationId: string, muted: boolean) => void;
  leaveConversation: (conversationId: string) => void;
  refetch: () => void;
}

export function useSocialInbox(): SocialInboxState {
  const dm = useDirectMessages();
  const { myGroups, loading: groupsLoading } = useGroups();
  const [latestByGroup, setLatestByGroup] = useState<Map<string, RawLatest>>(new Map());
  const [groupMsgLoading, setGroupMsgLoading] = useState(true);

  const groupIds = useMemo(() => myGroups.map((g) => g.id), [myGroups]);
  const groupIdsKey = groupIds.join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (groupIds.length === 0) {
        setLatestByGroup(new Map());
        setGroupMsgLoading(false);
        return;
      }
      setGroupMsgLoading(true);
      // Recent group messages across my groups, newest-first; keep the first
      // (latest) seen per group. Bounded so this never fans out per-group.
      const { data } = await supabase
        .from("group_messages")
        .select("group_id, content, image_url, created_at, sender_id")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(300);
      const rows = (data ?? []) as unknown as Array<{
        group_id: string; content: string; image_url: string | null; created_at: string; sender_id: string;
      }>;
      const latest = new Map<string, typeof rows[number]>();
      for (const r of rows) if (!latest.has(r.group_id)) latest.set(r.group_id, r);

      const senderIds = Array.from(new Set(Array.from(latest.values()).map((r) => r.sender_id)));
      const nameById = new Map<string, string>();
      if (senderIds.length) {
        const { data: profs } = await supabase
          .from("profiles_public" as never)
          .select("id, display_name, full_name")
          .in("id", senderIds);
        ((profs ?? []) as unknown as Array<{ id: string; display_name: string | null; full_name: string | null }>)
          .forEach((p) => nameById.set(p.id, p.display_name || p.full_name || "Member"));
      }

      const map = new Map<string, RawLatest>();
      latest.forEach((r, gid) => {
        map.set(gid, {
          content: r.content, image_url: r.image_url, created_at: r.created_at,
          senderId: r.sender_id, senderName: nameById.get(r.sender_id) ?? null,
        });
      });
      if (!cancelled) { setLatestByGroup(map); setGroupMsgLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdsKey]);

  const conversations = useMemo(() => {
    const me = dm.currentUserId;
    const dms = dm.conversations.map((c) => dmToConversation(c, me));
    const groups = myGroups.map((g) => {
      const raw = latestByGroup.get(g.id);
      const latest: GroupLatestMessage | null = raw
        ? { content: raw.content, image_url: raw.image_url, created_at: raw.created_at,
            senderName: raw.senderName, senderIsMe: raw.senderId === me }
        : null;
      return groupToConversation(g, latest);
    });
    return sortConversations([...dms, ...groups]);
  }, [dm.conversations, dm.currentUserId, myGroups, latestByGroup]);

  return {
    conversations,
    loading: dm.loading || groupsLoading || groupMsgLoading,
    error: dm.error,
    currentUserId: dm.currentUserId,
    markRead: dm.markRead,
    setMuted: dm.setMuted,
    leaveConversation: dm.leaveConversation,
    refetch: dm.refetch,
  };
}
