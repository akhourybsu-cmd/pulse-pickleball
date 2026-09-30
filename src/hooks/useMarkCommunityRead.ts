import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "./useAuthState";
import type { GroupMember } from "./useGroups";
import { withAuthDeadline } from "@/lib/authDeadline";
export async function markCommunityRead(
  client: QueryClient,
  groupId: string,
  userId: string,
) {
  const { data, error } = await withAuthDeadline((signal) =>
    supabase
      .rpc("mark_community_read", { p_group_id: groupId })
      .abortSignal(signal),
  );
  if (error) throw error;
  if (!data) return;
  // Cancel any directory fetch that started before the write, then reconcile from the server.
  await client.cancelQueries({ queryKey: ["groups", "joined", userId] });
  client.setQueriesData(
    { queryKey: ["groups", "joined", userId] },
    (old: any) =>
      Array.isArray(old)
        ? old.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  unread_count: 0,
                  membership: { ...group.membership, last_read_at: data },
                }
              : group,
          )
        : old,
  );
  client.setQueryData(["group-detail", groupId, userId], (old: any) =>
    old
      ? {
          ...old,
          membership: old.membership
            ? { ...old.membership, last_read_at: data }
            : null,
        }
      : old,
  );
  await client.invalidateQueries({ queryKey: ["groups", "joined", userId] });
}
export function useMarkCommunityRead(
  groupId: string | undefined,
  membership: GroupMember | null,
) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const entry = useRef("");
  useEffect(() => {
    if (!groupId || !user || membership?.status !== "active") return;
    const key = user.id + ":" + membership.id;
    if (entry.current === key) return;
    entry.current = key;
    void markCommunityRead(client, groupId, user.id).catch((error) => {
      entry.current = "";
      console.warn("Community read marker could not be saved", error);
    });
  }, [client, groupId, user?.id, membership?.id, membership?.status]);
}
