import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "./useAuthState";
import { useToast } from "./use-toast";
import { getErrorMessage } from "@/lib/getErrorMessage";
import {
  GroupSettings,
  parseGroupSettings,
  DEFAULT_GROUP_SETTINGS,
} from "@/types/groupSettings";
export function useGroupSettings(groupId: string | undefined) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const { toast } = useToast();
  const key = ["group-settings", groupId, user?.id];
  const query = useQuery({
    queryKey: key,
    enabled: !!groupId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("settings")
        .eq("id", groupId!)
        .single();
      if (error) throw error;
      return parseGroupSettings(data.settings);
    },
  });
  const mutation = useMutation({
    mutationFn: async (updates: Partial<GroupSettings>) => {
      if (!groupId || !user) throw new Error("Sign in and choose a community");
      const { data, error } = await supabase.rpc("patch_group_settings", {
        p_group_id: groupId,
        p_patch: updates,
      });
      if (error) throw error;
      return parseGroupSettings(data);
    },
    onSuccess: async (settings) => {
      client.setQueryData(key, settings);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["group-settings", groupId] }),
        client.invalidateQueries({ queryKey: ["group-detail", groupId] }),
        client.invalidateQueries({ queryKey: ["groups"] }),
      ]);
      toast({ title: "Settings saved" });
    },
    onError: (error) =>
      toast({
        title: "Settings not saved",
        description: getErrorMessage(error),
        variant: "destructive",
      }),
  });
  async function updateSettings(updates: Partial<GroupSettings>) {
    try {
      await mutation.mutateAsync(updates);
      return true;
    } catch {
      return false;
    }
  }
  return {
    settings: query.data ?? DEFAULT_GROUP_SETTINGS,
    loading: query.isPending,
    saving: mutation.isPending,
    error: query.error,
    updateSettings,
    updateSetting: <K extends keyof GroupSettings>(
      key: K,
      value: GroupSettings[K],
    ) => updateSettings({ [key]: value }),
    refetch: query.refetch,
  };
}
