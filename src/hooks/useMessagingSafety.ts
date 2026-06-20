import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DmPrivacy = 'friends' | 'nobody';

export interface BlockedUserRow {
  id: string;
  blocked_id: string;
  created_at: string;
  profile: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

/** Live list of users the current user has blocked, plus block/unblock helpers. */
export function useBlockedUsers() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const query = useQuery({
    queryKey: ['user-blocks', me],
    enabled: !!me,
    queryFn: async (): Promise<BlockedUserRow[]> => {
      const { data, error } = await (supabase as any)
        .from('user_blocks')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', me)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as Array<{ id: string; blocked_id: string; created_at: string }>;
      if (rows.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, display_name, full_name, avatar_url')
        .in('id', rows.map(r => r.blocked_id));
      const map = new Map((profiles || []).map(p => [p.id, p]));
      return rows.map(r => ({ ...r, profile: (map.get(r.blocked_id) as any) || null }));
    },
  });

  const block = useCallback(async (userId: string, reason?: string) => {
    if (!me || userId === me) return false;
    const { error } = await (supabase as any)
      .from('user_blocks')
      .insert({ blocker_id: me, blocked_id: userId, reason: reason || null });
    if (error && !/duplicate/i.test(error.message)) {
      toast.error('Failed to block user');
      return false;
    }
    // Also remove any friendship so they stop appearing in friends/suggestions.
    await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${me},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${me})`);
    toast.success('User blocked');
    qc.invalidateQueries({ queryKey: ['user-blocks'] });
    qc.invalidateQueries({ queryKey: ['friends'] });
    return true;
  }, [me, qc]);

  const unblock = useCallback(async (userId: string) => {
    if (!me) return false;
    const { error } = await (supabase as any)
      .from('user_blocks')
      .delete()
      .eq('blocker_id', me)
      .eq('blocked_id', userId);
    if (error) {
      toast.error('Failed to unblock user');
      return false;
    }
    toast.success('User unblocked');
    qc.invalidateQueries({ queryKey: ['user-blocks'] });
    return true;
  }, [me, qc]);

  return {
    me,
    blocked: query.data || [],
    loading: query.isLoading,
    block,
    unblock,
    refetch: query.refetch,
  };
}

/** Read or update the current user's DM privacy preference. */
export function useMessagingPrivacy() {
  const [privacy, setPrivacy] = useState<DmPrivacy>('friends');
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMe(user.id);
      const { data } = await (supabase as any)
        .from('user_messaging_prefs')
        .select('dm_privacy')
        .eq('user_id', user.id)
        .maybeSingle();
      setPrivacy(((data?.dm_privacy as DmPrivacy) || 'friends'));
      setLoading(false);
    })();
  }, []);

  const update = useCallback(async (next: DmPrivacy) => {
    if (!me) return;
    setPrivacy(next);
    const { error } = await (supabase as any)
      .from('user_messaging_prefs')
      .upsert({ user_id: me, dm_privacy: next }, { onConflict: 'user_id' });
    if (error) {
      toast.error('Failed to update privacy');
    } else {
      toast.success(next === 'nobody' ? 'Direct messages disabled' : 'Friends-only DMs enabled');
    }
  }, [me]);

  return { privacy, loading, update };
}

/** Report a user/message for admin review. */
export async function reportUser(opts: {
  reportedUserId: string;
  reason: string;
  details?: string;
  conversationId?: string;
  messageId?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast.error('Sign in required');
    return false;
  }
  const { error } = await (supabase as any).from('message_reports').insert({
    reporter_id: user.id,
    reported_user_id: opts.reportedUserId,
    reason: opts.reason,
    details: opts.details || null,
    conversation_id: opts.conversationId || null,
    message_id: opts.messageId || null,
  });
  if (error) {
    toast.error('Failed to submit report');
    return false;
  }
  toast.success('Report submitted');
  return true;
}
