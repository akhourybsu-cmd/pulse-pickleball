import { useState } from "react";
import type { HistoryMatch } from "../../../src/lib/matchHistory";
const game = (
  index: number,
  extra: Partial<HistoryMatch> = {}
): HistoryMatch => ({
  match_id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  match_date: "2026-09-26",
  created_at: `2026-09-26T${String((index % 12) + 10).padStart(2, "0")}:00:00Z`,
  my_team: 2,
  team1_score: index % 3 ? 7 : 11,
  team2_score: index % 3 ? 11 : 9,
  partner_id: "demo-1",
  partner_name: "Jordan Lee",
  opponent1_id: "demo-2",
  opponent1_name: "Taylor Chen",
  opponent2_id: "",
  opponent2_name: "Sam Rivera (G)",
  court_name: "Riverside Community Park · Pickleball Courts",
  won: index % 3 !== 0,
  rating_change: index % 3 ? 0.02345678 : -0.01876543,
  rating_after: 4.1234567,
  is_ranked: true,
  verified_by: ["demo-0", "demo-2"],
  registered_player_ids: ["demo-0", "demo-1", "demo-2"],
  approval_player_ids: ["demo-0", "demo-1", "demo-2"],
  ...extra,
});
const matches = [
  ...Array.from({ length: 12 }, (_, i) =>
    game(i + 1, {
      rr_event_id: "demo-event",
      rr_event_name: "Saturday Morning Doubles at Riverside Community Park",
      rr_event_date: "2026-09-26",
      source: "round_robin",
      round_no: i + 1,
      court_no: (i % 3) + 1,
      is_ranked: i !== 4,
    })
  ),
  game(20, { is_ranked: false, source: "casual", verified_by: [] }),
  game(21, {
    partner_id: "",
    partner_name: "",
    opponent2_name: "",
    opponent1_name: "Alexandria Montgomery-Worthington",
    rating_change: null,
    verified_by: [],
  }),
];
const pendingMatches = [
  game(30, { rating_change: null, verified_by: ["demo-1"] }),
  game(31, { rating_change: null }),
];
export function useMatchHistory(subject: string) {
  const [failed, setFailed] = useState(
    new URLSearchParams(window.location.search).has("error")
  );
  const empty = new URLSearchParams(window.location.search).has("empty");
  return {
    isPending: false,
    isError: failed,
    isFetching: false,
    data: failed
      ? undefined
      : {
          playerName: subject === "demo-0" ? "Alex Morgan" : "Taylor Chen",
          playerAvatarUrl: null,
          matches: empty ? [] : matches,
          pendingMatches: empty || subject !== "demo-0" ? [] : pendingMatches,
        },
    refetch: async () => {
      setFailed(false);
    },
  };
}
