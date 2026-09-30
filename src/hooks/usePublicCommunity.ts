import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Group } from "./useGroups";
import { withAuthDeadline } from "@/lib/authDeadline";
import type { VenueHomeSession } from "@/components/venue/VenueHome";

export interface PublicCommunity {
  id: string;
  name: string;
  description: string | null;
  visibility: "public";
  join_method: Group["join_method"];
  icon_url: string | null;
  cover_url: string | null;
  member_count: number;
  is_venue_verified: boolean;
  venue:
    | (NonNullable<Group["venue"]> & {
        address: string | null;
        booking_enabled: boolean;
      })
    | null;
  courts: {
    id: string;
    name: string | null;
    court_number: number;
    court_type: string | null;
    surface_type: string | null;
  }[];
}

export function usePublicCommunity(groupId?: string, slug?: string) {
  return useQuery({
    queryKey: ["public-community", groupId, slug],
    enabled: !!(groupId || slug),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .rpc("get_public_community", {
            p_group_id: groupId || null,
            p_venue_slug: slug || null,
          })
          .abortSignal(signal)
      );
      if (error) throw error;
      return data as unknown as PublicCommunity | null;
    },
  });
}

export function usePublicCommunityPrograms(groupId?: string, page = 0) {
  return useQuery({
    queryKey: ["public-community-programs", groupId, page],
    enabled: !!groupId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .rpc("get_public_community_programs", {
            p_group_id: groupId!,
            p_offset: page * 24,
          })
          .abortSignal(signal)
      );
      if (error) throw error;
      const rows = (data || []) as unknown as VenueHomeSession[];
      return { items: rows.slice(0, 24), hasMore: rows.length > 24 };
    },
  });
}
