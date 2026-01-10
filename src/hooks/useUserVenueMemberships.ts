import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VenueMembership {
  venueId: string;
  venueName: string;
  venueSlug: string | null;
  role: "owner" | "manager" | "organizer";
  logoUrl: string | null;
  city: string | null;
  state: string | null;
}

/**
 * Hook to fetch venues where the current user has tournament-creating permissions
 * (owner, manager, or organizer roles)
 */
export function useUserVenueMemberships() {
  return useQuery({
    queryKey: ["user-venue-memberships"],
    queryFn: async (): Promise<VenueMembership[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const memberships: VenueMembership[] = [];

      // Get venues where user is owner
      const { data: ownedVenues, error: ownedError } = await supabase
        .from("venues")
        .select("id, name, slug, logo_url, city, state")
        .eq("owner_id", user.id);

      if (ownedError) {
        console.error("Error fetching owned venues:", ownedError);
      } else if (ownedVenues) {
        for (const venue of ownedVenues) {
          memberships.push({
            venueId: venue.id,
            venueName: venue.name,
            venueSlug: venue.slug,
            role: "owner",
            logoUrl: venue.logo_url,
            city: venue.city,
            state: venue.state,
          });
        }
      }

      // Get venues where user is staff with manager/organizer role
      const { data: staffVenues, error: staffError } = await supabase
        .from("venue_staff")
        .select(`
          venue_id,
          role,
          venues:venue_id (
            id,
            name,
            slug,
            logo_url,
            city,
            state
          )
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .in("role", ["manager", "organizer"]);

      if (staffError) {
        console.error("Error fetching staff venues:", staffError);
      } else if (staffVenues) {
        for (const staff of staffVenues) {
          const venue = staff.venues as any;
          // Avoid duplicates (user might be both owner and staff)
          if (venue && !memberships.some((m) => m.venueId === venue.id)) {
            memberships.push({
              venueId: venue.id,
              venueName: venue.name,
              venueSlug: venue.slug,
              role: staff.role as "manager" | "organizer",
              logoUrl: venue.logo_url,
              city: venue.city,
              state: venue.state,
            });
          }
        }
      }

      return memberships;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
