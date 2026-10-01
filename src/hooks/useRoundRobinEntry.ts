import { useQuery } from "@tanstack/react-query";
import { useAuthState } from "@/hooks/useAuthState";
import { supabase } from "@/integrations/supabase/client";
import { withAuthDeadline } from "@/lib/authDeadline";
import type { RoundRobinEntryData } from "@/lib/roundRobin/sharing";

export function useRoundRobinEntry(eventId: string, inviteCode?: string | null) {
  const auth = useAuthState();
  const query = useQuery({
    queryKey: ["round-robin-entry", eventId, inviteCode ?? "", auth.user?.id ?? "guest", auth.isAuthenticated],
    enabled: !!eventId && !auth.loading,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await withAuthDeadline(signal => supabase.rpc("get_round_robin_entry", {
        p_event_id: eventId, p_invite_code: inviteCode || undefined,
      }).abortSignal(signal));
      if (error) throw error;
      return data as unknown as RoundRobinEntryData | null;
    },
  });
  return { ...query, auth };
}
