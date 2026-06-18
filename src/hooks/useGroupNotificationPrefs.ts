import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type GroupChannel = 'all' | 'posts' | 'events' | 'chat' | 'announcements';

export interface GroupNotificationPrefs {
  muted_all: boolean;
  posts: boolean;
  events: boolean;
  chat: boolean;
  announcements: boolean;
}

const DEFAULTS: GroupNotificationPrefs = {
  muted_all: false,
  posts: true,
  events: true,
  chat: true,
  announcements: true,
};

async function fetchPrefs(groupId: string): Promise<GroupNotificationPrefs> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULTS;

  const { data, error } = await supabase
    .from('group_notification_prefs' as any)
    .select('muted_all, posts, events, chat, announcements')
    .eq('user_id', user.id)
    .eq('group_id', groupId)
    .maybeSingle();

  if (error || !data) return DEFAULTS;
  return { ...DEFAULTS, ...(data as any) };
}

/**
 * Read + toggle the viewer's per-group notification preferences.
 *
 * The RPC handles row creation (upsert with defaults) so the client
 * doesn't have to know whether a row exists. Optimistic update on the
 * cache so the toggle flips immediately.
 */
export function useGroupNotificationPrefs(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['group-notif-prefs', groupId];

  const { data: prefs = DEFAULTS } = useQuery({
    queryKey,
    queryFn: () => fetchPrefs(groupId!),
    staleTime: 60 * 1000,
    enabled: !!groupId,
  });

  const setPrefMutation = useMutation({
    mutationFn: async ({ channel, enabled }: { channel: GroupChannel; enabled: boolean }) => {
      const { error } = await supabase.rpc('set_group_notification_pref' as any, {
        p_group_id: groupId,
        p_channel: channel,
        p_enabled: enabled,
      });
      if (error) throw error;
    },
    onMutate: async ({ channel, enabled }) => {
      // Optimistic update — flip the local cache so the switch responds
      // instantly. Reconciled by the invalidation in onSettled.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<GroupNotificationPrefs>(queryKey);
      queryClient.setQueryData<GroupNotificationPrefs>(queryKey, (prev) => {
        const next = { ...(prev ?? DEFAULTS) };
        if (channel === 'all') next.muted_all = !enabled;
        else (next as any)[channel] = enabled;
        return next;
      });
      return { previous };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast({
        title: 'Could not update notifications',
        description: err?.message || 'Try again in a moment',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    prefs,
    setPref: (channel: GroupChannel, enabled: boolean) =>
      setPrefMutation.mutate({ channel, enabled }),
  };
}
