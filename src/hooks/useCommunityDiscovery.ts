import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Group } from "./useGroups";
import type { CommunityArea } from "@/lib/community/discovery";
import { withAuthDeadline } from "@/lib/authDeadline";
export interface CommunityDiscoveryResult {
  items: Group[];
  has_more: boolean;
}
export function useCommunityDiscovery(
  search: string,
  page: number,
  area: CommunityArea,
  enabled = true,
) {
  return useQuery({
    queryKey: ["community-discovery", search, page, area.city, area.state],
    enabled,
    staleTime: 30000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .rpc("discover_communities", {
            p_search: search,
            p_offset: page * 24,
            p_city: area.city,
            p_state: area.state,
          })
          .abortSignal(signal),
      );
      if (error) throw error;
      return data as unknown as CommunityDiscoveryResult;
    },
  });
}
