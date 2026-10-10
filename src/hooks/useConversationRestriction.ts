import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withAuthDeadline } from '@/lib/authDeadline';

/** Keep a late privacy response attached to the two people it describes. */
export function useConversationRestriction(userId: string | null, participantId?: string) {
  return useQuery({
    queryKey: ['conversation-restriction', userId, participantId],
    enabled: !!userId && !!participantId,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: () => withAuthDeadline(async signal => {
      const { data: blocks, error: blocksError } = await supabase
        .from('user_blocks').select('blocker_id, blocked_id')
        .or(`and(blocker_id.eq.${userId},blocked_id.eq.${participantId}),and(blocker_id.eq.${participantId},blocked_id.eq.${userId})`)
        .abortSignal(signal);
      if (blocksError) throw blocksError;
      if (blocks?.length) {
        return blocks.some(block => block.blocker_id === userId)
          ? "You've blocked this user. Unblock from Settings to message."
          : "You can't message this user.";
      }
      const { data: prefs, error: prefsError } = await supabase
        .from('user_messaging_prefs').select('dm_privacy')
        .eq('user_id', participantId!).abortSignal(signal).maybeSingle();
      if (prefsError) throw prefsError;
      return prefs?.dm_privacy === 'nobody' ? 'This user is not accepting messages.' : null;
    }),
  });
}
