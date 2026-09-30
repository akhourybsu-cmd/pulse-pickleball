import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { matchesCommunity, nearbyCommunities } from "@/lib/community/discovery";
const owner = "directory-local-owner";
const rows = [
  {
    id: "rally",
    name: "Rally Haus Sports",
    type: "venue_official",
    is_venue_verified: true,
    description: "Courts, clinics, and your next great game.",
    venue: {
      name: "Rally Haus Sports",
      city: "Attleboro",
      state: "MA",
      logo_url: "/venues/rally-haus/official-brand.png",
      logo_image_fit: "contain",
      logo_shape: "circle",
      primary_color: "#0a6fdb",
      cover_image_url: "/venues/rally-haus/facility-preview.png",
    },
    unread_count: 3,
  },
  {
    id: "crew",
    name: "Tuesday Night Pickleball Crew",
    type: "crew",
    description: "Friendly games after work. All levels welcome.",
    city: "Attleboro",
    state: "MA",
  },
  {
    id: "league",
    name: "Boston Weekend League",
    type: "league",
    city: "Boston",
    state: "MA",
  },
  {
    id: "away",
    name: "Austin Pickleball Club",
    type: "club",
    city: "Austin",
    state: "TX",
  },
].map((g, i) => ({
  visibility: "public",
  join_method: "open",
  member_count: 20 + i * 10,
  icon_url: null,
  settings: {},
  ...g,
}));
export const useAuthState = () => ({
  user: { id: owner },
  profile: { town: "Attleboro", state: "MA" },
  isAuthenticated: true,
});
export const useGroups = () => {
  const [joined, setJoined] = useState(
    rows.slice(0, 2).map((g) => ({
      ...g,
      membership: { status: "active", role: "member", id: g.id },
    })),
  );
  return {
    myGroups: joined,
    loading: false,
    error: null,
    refetch: async () => {},
    createGroup: async () => null,
    joinGroupByCode: async () => null,
    joinPublicGroup: async (id: string) => {
      setJoined((old) => [
        ...old,
        {
          ...rows.find((g) => g.id === id)!,
          membership: { status: "active", role: "member", id },
        },
      ]);
    },
  };
};
export const useCommunityDiscovery = (
  search: string,
  page: number,
  area: any,
  enabled = true,
) =>
  useQuery({
    queryKey: ["local-discovery", search, page, area],
    enabled,
    queryFn: async () => ({
      items: nearbyCommunities(
        rows
          .filter((g) => matchesCommunity(g as any, search))
          .map(({ unread_count, ...g }: any) => g),
        area,
      ),
      has_more: false,
    }),
  });
export const fetchGroupPosts = async () => [];
export const fetchGroupEvents = async () => [];
export const supabase = {
  from: () => {
    throw new Error("Live backend is blocked in this local fixture");
  },
  functions: {
    invoke: () => {
      throw new Error("External calls are blocked");
    },
  },
};
