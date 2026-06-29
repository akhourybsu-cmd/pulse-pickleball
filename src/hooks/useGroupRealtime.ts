import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GroupMessage } from './useGroupChat';
import type { GroupPost } from './useGroupPosts';
import type { PostComment } from './useGroupPostComments';
import type { GroupEvent } from './useGroupEvents';

/**
 * Granular realtime: patch React Query caches in place instead of invalidating.
 * This keeps the feed/chat snappy and avoids re-running the multi-query fetch
 * for every reaction or comment that streams in.
 *
 * Self-originated events are skipped because optimistic mutations already
 * applied the change locally.
 */
export function useGroupRealtime(groupId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) return;

    let currentUserId: string | null = null;
    supabase.auth.getUser().then(({ data }) => {
      currentUserId = data.user?.id || null;
    });

    const messagesKey = ['group-messages', groupId];
    const postsKey = ['group-posts', groupId];

    const hydrateProfile = async (userId: string) => {
      // Try cache first via any existing message/post with the same author
      const fromMessages = (queryClient.getQueryData<GroupMessage[]>(messagesKey) || [])
        .find((m) => m.user_id === userId)?.profile;
      if (fromMessages) return fromMessages;
      const fromPosts = (queryClient.getQueryData<GroupPost[]>(postsKey) || [])
        .find((p) => p.user_id === userId)?.profile;
      if (fromPosts) return fromPosts;
      const { data } = await supabase
        .from('profiles_public')
        .select('id, display_name, full_name, avatar_url, current_rating')
        .eq('id', userId)
        .maybeSingle();
      return data || undefined;
    };

    const channel = supabase
      .channel(`group_realtime_${groupId}`)

      // ===== Messages =====
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, async (payload) => {
        const row = payload.new as any;
        if (row.user_id === currentUserId) {
          // Replace optimistic temp row matched by user+content+recent window.
          queryClient.setQueryData<GroupMessage[]>(messagesKey, (prev = []) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const idx = prev.findIndex(
              (m) => m._status === 'sending' && m.user_id === row.user_id && m.content === row.content,
            );
            if (idx >= 0) {
              const next = [...prev];
              const author = prev.find((m) => m.user_id === row.user_id)?.profile;
              next[idx] = { ...row, profile: author, _status: 'sent' };
              return next;
            }
            const author = prev.find((m) => m.user_id === row.user_id)?.profile;
            return [...prev, { ...row, profile: author, _status: 'sent' }];
          });
          return;
        }
        const profile = await hydrateProfile(row.user_id);
        queryClient.setQueryData<GroupMessage[]>(messagesKey, (prev = []) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, { ...row, profile, _status: 'sent' }];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const row = payload.new as any;
        queryClient.setQueryData<GroupMessage[]>(messagesKey, (prev = []) =>
          prev.map((m) => (m.id === row.id ? { ...m, ...row } : (
            // If this row was pinned, unpin any others to keep single-pin invariant.
            row.is_pinned && m.is_pinned ? { ...m, is_pinned: false } : m
          ))),
        );
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const oldRow = payload.old as any;
        queryClient.setQueryData<GroupMessage[]>(messagesKey, (prev = []) =>
          prev.filter((m) => m.id !== oldRow.id),
        );
      })

      // ===== Posts =====
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_posts',
        filter: `group_id=eq.${groupId}`,
      }, async (payload) => {
        const row = payload.new as any;
        if (row.user_id === currentUserId) {
          // Self post: optimistic row is already in cache. Swap temp id for real.
          queryClient.setQueryData<GroupPost[]>(postsKey, (prev = []) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            const idx = prev.findIndex(
              (p) => p.id.startsWith('temp-') && p.user_id === row.user_id && p.content === row.content,
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...row, id: row.id };
              return next;
            }
            return prev;
          });
          return;
        }
        const profile = await hydrateProfile(row.user_id);
        queryClient.setQueryData<GroupPost[]>(postsKey, (prev = []) => {
          if (prev.some((p) => p.id === row.id)) return prev;
          const newPost = {
            ...row,
            profile,
            reactions: [],
            comment_count: 0,
            participant_count: 0,
            user_joined: false,
          } as GroupPost;
          // Keep pinned-first ordering, otherwise prepend.
          const pinned = prev.filter((p) => p.pinned);
          const rest = prev.filter((p) => !p.pinned);
          return row.pinned ? [newPost, ...pinned, ...rest] : [...pinned, newPost, ...rest];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'group_posts',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const row = payload.new as any;
        queryClient.setQueryData<GroupPost[]>(postsKey, (prev = []) =>
          prev.map((p) => (p.id === row.id ? { ...p, ...row } : p)),
        );
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'group_posts',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const oldRow = payload.old as any;
        queryClient.setQueryData<GroupPost[]>(postsKey, (prev = []) =>
          prev.filter((p) => p.id !== oldRow.id),
        );
      })

      // ===== Post reactions (patch single post) =====
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_post_reactions',
      }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (!row?.post_id) return;
        const isSelf = row.user_id === currentUserId;
        if (isSelf) return; // optimistic already applied
        queryClient.setQueryData<GroupPost[]>(postsKey, (prev = []) =>
          prev.map((p) => {
            if (p.id !== row.post_id) return p;
            const reactions = [...(p.reactions || [])];
            const entry = reactions.find((r) => r.emoji === row.emoji);
            if (payload.eventType === 'INSERT') {
              if (entry) entry.count += 1;
              else reactions.push({ emoji: row.emoji, count: 1, user_reacted: false });
            } else if (payload.eventType === 'DELETE') {
              if (entry) {
                entry.count = Math.max(0, entry.count - 1);
              }
            }
            return { ...p, reactions: reactions.filter((r) => r.count > 0) };
          }),
        );
      })

      // ===== Post comments (bump parent count + patch comments cache) =====
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_post_comments',
      }, async (payload) => {
        const row = (payload.new || payload.old) as any;
        if (!row?.post_id) return;
        const delta = payload.eventType === 'INSERT' ? 1
          : payload.eventType === 'DELETE' ? -1 : 0;
        if (delta !== 0) {
          queryClient.setQueryData<GroupPost[]>(postsKey, (prev = []) =>
            prev.map((p) =>
              p.id === row.post_id
                ? { ...p, comment_count: Math.max(0, (p.comment_count || 0) + delta) }
                : p,
            ),
          );
        }
        // If a comments sheet is open for this post, patch its cache too.
        const commentsKey = ['post-comments', row.post_id];
        const cached = queryClient.getQueryData<PostComment[]>(commentsKey);
        if (!cached) return; // sheet not open
        if (payload.eventType === 'INSERT') {
          if (row.user_id === currentUserId) return; // optimistic handled it
          const profile = await hydrateProfile(row.user_id);
          queryClient.setQueryData<PostComment[]>(commentsKey, (prev = []) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            const newC: PostComment = { ...row, profile, replies: [] };
            if (row.parent_comment_id) {
              return prev.map((c) =>
                c.id === row.parent_comment_id
                  ? { ...c, replies: [...(c.replies || []), newC] }
                  : c,
              );
            }
            return [...prev, newC];
          });
        } else if (payload.eventType === 'DELETE') {
          queryClient.setQueryData<PostComment[]>(commentsKey, (prev = []) =>
            prev
              .filter((c) => c.id !== row.id)
              .map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== row.id) })),
          );
        }
      })

      // ===== LFG participants (patch participant_count on the post) =====
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_post_participants',
      }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (!row?.post_id || row.user_id === currentUserId) return;
        const delta = payload.eventType === 'INSERT' ? 1
          : payload.eventType === 'DELETE' ? -1 : 0;
        if (!delta) return;
        queryClient.setQueryData<GroupPost[]>(postsKey, (prev = []) =>
          prev.map((p) =>
            p.id === row.post_id
              ? { ...p, participant_count: Math.max(0, (p.participant_count || 0) + delta) }
              : p,
          ),
        );
      })

      // ===== Lower-frequency tables — invalidate as before =====
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_events',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
      })
      // RSVP changes patch the affected event's rsvp counts in place
      // instead of invalidating the entire events list. Pre-patch, 20
      // concurrent RSVPs to one event caused 20 full ['group-events']
      // refetches. Mirrors the post-reactions patch pattern above.
      // Self-originated changes are skipped — the optimistic update
      // in useGroupEvents.toggleRSVP already applied them locally.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_event_rsvps',
      }, (payload) => {
        const newRow = payload.new as { event_id?: string; user_id?: string; status?: GroupEvent['user_rsvp'] } | null;
        const oldRow = payload.old as { event_id?: string; user_id?: string; status?: GroupEvent['user_rsvp'] } | null;
        const eventId = newRow?.event_id ?? oldRow?.event_id;
        if (!eventId) return;
        const userId = newRow?.user_id ?? oldRow?.user_id;
        if (userId === currentUserId) return; // optimistic already applied

        const key = ['group-events', groupId];
        queryClient.setQueryData<GroupEvent[]>(key, (prev) => {
          if (!prev) return prev;
          // Skip if the event isn't in this group's cached list (the
          // subscription is unfiltered by group_id since rsvps don't
          // carry one; non-matching events are just no-ops).
          const idx = prev.findIndex((e) => e.id === eventId);
          if (idx === -1) return prev;
          const event = prev[idx];
          const rsvps = { ...(event.rsvps ?? { going: 0, maybe: 0, not_going: 0, waitlist: 0 }) };
          const bump = (status: GroupEvent['user_rsvp'], delta: number) => {
            if (!status) return;
            (rsvps as Record<string, number>)[status] = Math.max(
              0,
              ((rsvps as Record<string, number>)[status] || 0) + delta,
            );
          };
          if (payload.eventType === 'INSERT') {
            bump(newRow?.status, +1);
          } else if (payload.eventType === 'DELETE') {
            bump(oldRow?.status, -1);
          } else if (payload.eventType === 'UPDATE') {
            if (oldRow?.status !== newRow?.status) {
              bump(oldRow?.status, -1);
              bump(newRow?.status, +1);
            }
          }
          const next = [...prev];
          next[idx] = { ...event, rsvps };
          return next;
        });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}
