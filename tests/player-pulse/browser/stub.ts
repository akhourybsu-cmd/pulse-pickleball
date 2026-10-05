import { useState } from "react";
import { format, subDays } from "date-fns";
import {
  buildPlayerPulse,
  type PulseMatchRow,
} from "../../../src/lib/playerPulse";
export const scenario =
  new URLSearchParams(window.location.search).get("scenario") || "established";
const count =
  scenario === "empty"
    ? 0
    : scenario === "single"
    ? 1
    : scenario === "long"
    ? 1505
    : 48;
const today = new Date();
let rating = 3.25;
const rows: PulseMatchRow[] = Array.from({ length: count }, (_, i) => {
  const before = rating,
    change = [0.038, -0.022, 0.016, 0.004, -0.045, 0.051][i % 6];
  rating = Math.max(2.5, Math.min(5.4, rating + change));
  return {
    matchId: `m-${String(i).padStart(5, "0")}`,
    matchDate: format(
      subDays(today, (count - 1 - i) * 2 + (scenario === "inactive" ? 130 : 0)),
      "yyyy-MM-dd"
    ),
    createdAt: new Date(today.getTime() + i * 1000).toISOString(),
    team: 1,
    team1Score: change > 0 ? 11 : 7,
    team2Score: change > 0 ? 7 : 11,
    ratingBefore: before,
    ratingAfter: rating,
    ratingChange: rating - before,
    source: i % 3 === 0 ? "round_robin" : i % 3 === 1 ? "league" : "manual",
  };
});
if (scenario === "missing") {
  rows[47] = {
    ...rows[47],
    ratingAfter: null,
    ratingChange: null,
    team1Score: null,
  };
  rows[46] = {
    ...rows[46],
    ratingChange: 0,
    ratingAfter: rows[46].ratingBefore,
  };
  rows[45] = { ...rows[45], ratingChange: null };
  rows[44] = { ...rows[44], team1Score: 8, team2Score: 8 };
}
const data = buildPlayerPulse(rows, { currentRating: rating }, Date.now());
export function useAuthState() {
  return { user: { id: `pulse-fixture-${scenario}` }, loading: false };
}
export function usePlayerPulse() {
  const [retried, retry] = useState(false);
  const failed = scenario === "error" && !retried;
  return {
    data: failed ? undefined : data,
    isLoading: false,
    isFetching: false,
    isError: failed,
    refetch: async () => retry(true),
  };
}
