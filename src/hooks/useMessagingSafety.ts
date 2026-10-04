import { withAuthDeadline } from "@/lib/authDeadline";
import { useCallback, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthState } from "@/hooks/useAuthState";

export type DmPrivacy = "friends" | "nobody";

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
  const { user } = useAuthState();
  const me = user?.id ?? null;
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const unblockLock = useRef(false);

  const query = useQuery({
    queryKey: ["user-blocks", me],
    enabled: !!me,
    queryFn: async (): Promise<BlockedUserRow[]> => {
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .from("user_blocks")
          .select("id, blocked_id, created_at")
          .eq("blocker_id", me)
          .order("created_at", { ascending: false })
          .abortSignal(signal)
      );
      if (error) throw error;
      const rows = (data || []) as Array<{
        id: string;
        blocked_id: string;
        created_at: string;
      }>;
      if (rows.length === 0) return [];
      const { data: profiles, error: profileError } = await withAuthDeadline(
        (signal) =>
          supabase
            .from("profiles_public")
            .select("id, display_name, full_name, avatar_url")
            .in(
              "id",
              rows.map((r) => r.blocked_id)
            )
            .abortSignal(signal)
      );
      if (profileError) throw profileError;
      const map = new Map((profiles || []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        profile: (map.get(r.blocked_id) as any) || null,
      }));
    },
  });

  const block = useCallback(
    async (userId: string, reason?: string) => {
      if (!me || userId === me) return false;
      const { error } = await supabase.rpc("block_player", {
        p_user_id: userId,
        p_reason: reason || undefined,
      });
      if (error) {
        toast.error("Failed to block user");
        return false;
      }
      toast.success("User blocked");
      qc.invalidateQueries({ queryKey: ["user-blocks"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend-suggestions"] });
      return true;
    },
    [me, qc]
  );

  const unblock = useCallback(
    async (userId: string) => {
      if (!me || unblockLock.current) return false;
      unblockLock.current = true;
      setUnblocking(userId);
      try {
        const { error } = await withAuthDeadline((signal) =>
          supabase
            .from("user_blocks")
            .delete()
            .eq("blocker_id", me)
            .eq("blocked_id", userId)
            .abortSignal(signal)
        );
        if (error) throw error;
        qc.setQueryData<BlockedUserRow[]>(["user-blocks", me], (old) =>
          (old ?? []).filter((row) => row.blocked_id !== userId)
        );
        toast.success("Player unblocked");
        for (const key of ["user-blocks", "friends", "friend-suggestions"])
          void qc.invalidateQueries({ queryKey: [key] });
        return true;
      } catch {
        toast.error("Could not unblock this player. Please try again.");
        return false;
      } finally {
        unblockLock.current = false;
        setUnblocking(null);
      }
    },
    [me, qc]
  );

  return {
    me,
    blocked: query.data || [],
    loading: query.isLoading,
    error: query.isError,
    unblocking,
    block,
    unblock,
    refetch: query.refetch,
  };
}

/** Read or update the current user's DM privacy preference. */
export function useMessagingPrivacy() {
  const { user } = useAuthState();
  const me = user?.id;
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const query = useQuery({
    queryKey: ["messaging-privacy", me],
    enabled: !!me,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<DmPrivacy> => {
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .from("user_messaging_prefs")
          .select("dm_privacy")
          .eq("user_id", me!)
          .abortSignal(signal)
          .maybeSingle()
      );
      if (error) throw error;
      return data?.dm_privacy === "nobody" ? "nobody" : "friends";
    },
  });
  const update = async (next: DmPrivacy) => {
    if (
      !me ||
      lock.current ||
      !query.data ||
      query.isError ||
      !["friends", "nobody"].includes(next)
    )
      return false;
    lock.current = true;
    setSaving(true);
    try {
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .from("user_messaging_prefs")
          .upsert({ user_id: me, dm_privacy: next }, { onConflict: "user_id" })
          .select("dm_privacy")
          .abortSignal(signal)
          .single()
      );
      if (error) throw error;
      if (data?.dm_privacy !== next)
        throw new Error("Preference was not confirmed.");
      client.setQueryData(["messaging-privacy", me], next);
      toast.success(
        next === "nobody"
          ? "New direct messages disabled"
          : "Friends-only messages enabled"
      );
      return true;
    } catch {
      toast.error("Privacy setting was not saved. Please try again.");
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return {
    privacy: query.data ?? "friends",
    loading: !!me && query.isLoading,
    saving,
    error: query.isError,
    refetch: query.refetch,
    update,
  };
}

/** Report a user/message for admin review. */
export async function reportUser(opts: {
  reportedUserId: string;
  reason: string;
  details?: string;
  conversationId?: string;
  messageId?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    toast.error("Sign in required");
    return false;
  }
  const { error } = await (supabase as any).from("message_reports").insert({
    reporter_id: user.id,
    reported_user_id: opts.reportedUserId,
    reason: opts.reason,
    details: opts.details || null,
    conversation_id: opts.conversationId || null,
    message_id: opts.messageId || null,
  });
  if (error) {
    toast.error("Failed to submit report");
    return false;
  }
  toast.success("Report submitted");
  return true;
}
