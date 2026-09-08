import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";
import { toast } from "sonner";

export interface SuggestedFriend {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  reason: string;
  weight: number;
}

export function useFriendSuggestions(enabled = true) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const key = ["friend-suggestions", user?.id];
  const query = useQuery({
    queryKey: key,
    enabled: enabled && !!user,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("suggest_friends")
        .abortSignal(signal);
      if (error) throw error;
      return (data || []) as SuggestedFriend[];
    },
  });
  const dismiss = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase
        .from("friend_suggestion_dismissals")
        .upsert(
          { user_id: user.id, dismissed_user_id: userId },
          { onConflict: "user_id,dismissed_user_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    },
    onMutate: async (userId) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<SuggestedFriend[]>(key) ?? [];
      client.setQueryData(
        key,
        previous.filter((row) => row.id !== userId)
      );
      return previous.find((row) => row.id === userId);
    },
    onError: (_error, _userId, previous) => {
      if (previous)
        client.setQueryData<SuggestedFriend[]>(key, (current) =>
          current?.some((row) => row.id === previous.id)
            ? current
            : [...(current ?? []), previous]
        );
      toast.error("Could not hide this suggestion. Please try again.");
    },
  });
  return {
    suggestions: query.data ?? [],
    loading: query.isPending && enabled && !!user,
    error: query.isError
      ? "Could not load suggestions. Please try again."
      : null,
    refetch: query.refetch,
    dismissSuggestion: dismiss.mutate,
  };
}
