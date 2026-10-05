/** Read-only analytics. Never infer a missing rating, score or movement as zero.
 * Inputs are approved, non-voided, ranked rows for the signed-in player. */
import { parseISO, format, startOfDay, subDays, isValid } from "date-fns";
import {
  placementStatus,
  PROVISIONAL_MATCHES,
} from "@/lib/rating/placementStatus";

export type PulseRange = "last10" | "30d" | "90d" | "all";
export type PulseOutcome = "win" | "loss" | "draw" | "unscored";
export interface PulseMatchRow {
  matchId: string;
  matchDate: string;
  createdAt: string;
  team: 1 | 2;
  team1Score: number | null;
  team2Score: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
  source: string | null;
}
export interface PulseMatch extends PulseMatchRow {
  index: number;
  outcome: PulseOutcome;
  scoreLabel: string;
  pointsFor: number | null;
  pointsAgainst: number | null;
}
export interface TimelinePoint {
  matchId: string;
  date: string;
  index: number;
  rating: number;
  ratingBefore: number | null;
  ratingChange: number | null;
  outcome: PulseOutcome;
  scoreLabel: string;
  source: string | null;
}
export interface ConfidenceInfo {
  label: string;
  detail: string;
  nextStep: string | null;
  progress: number;
  played: number;
  target: number;
}
export type MomentumState = "rising" | "steady" | "recalibrating";
export interface MomentumInfo {
  state: MomentumState;
  label: string;
  count: number;
  net: number;
  lastDate: string;
  points: string[];
}
export interface PersonalBest {
  rating: number;
  date: string;
  isCurrent: boolean;
}
export interface PulseProfileInput {
  currentRating: number | null;
}
export interface PlayerPulse {
  currentRating: number | null;
  matches: PulseMatch[];
  timeline: TimelinePoint[];
  matchCount: number;
  ratedMatchCount: number;
  missingSnapshotCount: number;
  thirtyDayChange: number | null;
  thirtyDayMatchCount: number;
  confidence: ConfidenceInfo;
  personalBest: PersonalBest | null;
  asOf: number;
}

const finite = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n);
const validScore = (n: number | null): n is number =>
  finite(n) && Number.isInteger(n) && n >= 0;
export const pulseDate = (value: string) => parseISO(value);
export function formatPulseDate(value: string, pattern = "MMM d, yyyy") {
  const date = pulseDate(value);
  return isValid(date) ? format(date, pattern) : "Date unavailable";
}
export function formatPulseDelta(value: number | null): string {
  if (!finite(value)) return "—";
  const rounded = Math.abs(value).toFixed(3);
  if (Number(rounded) === 0) return "0.000";
  return `${value > 0 ? "+" : "−"}${rounded}`;
}
export function pulseSource(source: string | null): string {
  if (source === "round_robin") return "Round robin";
  if (source === "league" || source === "league_ladder" || source === "ladder")
    return "League";
  return "Ranked match";
}
function byChrono(a: PulseMatchRow, b: PulseMatchRow) {
  return (
    a.matchDate.localeCompare(b.matchDate) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.matchId.localeCompare(b.matchId)
  );
}
function outcomeFor(row: PulseMatchRow): PulseOutcome {
  if (!validScore(row.team1Score) || !validScore(row.team2Score))
    return "unscored";
  if (row.team1Score === row.team2Score) return "draw";
  return (
    row.team === 1
      ? row.team1Score > row.team2Score
      : row.team2Score > row.team1Score
  )
    ? "win"
    : "loss";
}
function inDays(date: string, days: number, nowMs: number) {
  const time = pulseDate(date).getTime();
  // Include today and the preceding N-1 calendar days. SQL dates are local
  // dates, so Oct 5 must never appear as Oct 4 in US timezones.
  return (
    time >= subDays(startOfDay(nowMs), days - 1).getTime() && time <= nowMs
  );
}
export function filterPulseMatches(
  matches: PulseMatch[],
  range: PulseRange,
  nowMs: number
) {
  if (range === "all") return matches;
  if (range === "last10") return matches.slice(-10);
  return matches.filter((row) =>
    inDays(row.matchDate, range === "30d" ? 30 : 90, nowMs)
  );
}
/** History depth through the engine's provisional period, never a statistical
 * confidence percentage. Progress does not reset at placement match five. */
export function computeConfidence(count: number): ConfidenceInfo {
  const played = Math.max(0, Math.floor(count));
  const placement = placementStatus(played);
  return {
    label: placement.isPreliminary
      ? "Placement in progress"
      : played < PROVISIONAL_MATCHES
      ? "Provisional rating"
      : "Established rating",
    detail: `Based on ${played} recorded rating ${
      played === 1 ? "result" : "results"
    }. Match history describes your rating's foundation, not a statistical confidence percentage.`,
    nextStep: placement.isPreliminary
      ? `${placement.remaining} more rated ${
          placement.remaining === 1 ? "match" : "matches"
        } to finish placement.`
      : played < PROVISIONAL_MATCHES
      ? `${PROVISIONAL_MATCHES - played} more rated ${
          PROVISIONAL_MATCHES - played === 1 ? "match" : "matches"
        } to complete the provisional period.`
      : null,
    played,
    target: PROVISIONAL_MATCHES,
    progress: Math.min(1, played / PROVISIONAL_MATCHES),
  };
}
export function computeMomentum(sorted: PulseMatchRow[]): MomentumInfo | null {
  // Missing values are not backfilled by older matches to manufacture form.
  const recent = sorted
    .slice(-10)
    .filter((row) => finite(row.ratingAfter) && finite(row.ratingChange));
  if (recent.length < 5) return null;
  const net = recent.reduce((sum, row) => sum + row.ratingChange!, 0);
  const wins = recent.filter((row) => outcomeFor(row) === "win").length;
  const losses = recent.filter((row) => outcomeFor(row) === "loss").length;
  const ups = recent.filter((row) => row.ratingChange! > 0).length;
  // Decimal changes can sum to 0.030000000000000002. Ignore binary noise
  // at the trend boundary without rounding the recorded values or net change.
  const threshold = 0.03 + 1e-9;
  const state =
    net > threshold ? "rising" : net < -threshold ? "recalibrating" : "steady";
  return {
    state,
    label:
      state === "rising"
        ? "Rising"
        : state === "recalibrating"
        ? "Recalibrating"
        : "Steady",
    count: recent.length,
    net,
    lastDate: recent[recent.length - 1].matchDate,
    points: [
      `${wins} wins · ${losses} losses in ${recent.length} rated results`,
      `Rating rose in ${ups} of those results`,
    ],
  };
}
/** Actual before/after snapshots. A missing baseline stays unknown; no
 * activity is distinguished from zero movement. */
export function computeThirtyDayChange(
  sorted: PulseMatchRow[],
  nowMs: number
): number | null {
  const recent = sorted.filter((row) => inDays(row.matchDate, 30, nowMs));
  if (!recent.length || recent.some((row) => !finite(row.ratingAfter)))
    return null;
  const first = recent[0],
    last = recent[recent.length - 1];
  return finite(first.ratingBefore) && finite(last.ratingAfter)
    ? last.ratingAfter - first.ratingBefore
    : null;
}
export function computePersonalBest(
  sorted: PulseMatchRow[],
  currentRating: number | null
): PersonalBest | null {
  const rated = sorted.filter((row) => finite(row.ratingAfter));
  if (!rated.length) return null;
  const best = rated.reduce((a, b) =>
    b.ratingAfter! > a.ratingAfter! ? b : a
  );
  return {
    rating: best.ratingAfter!,
    date: best.matchDate,
    isCurrent:
      finite(currentRating) &&
      Math.abs(currentRating - best.ratingAfter!) < 0.0000001,
  };
}
export function summarizePulseMatches(matches: PulseMatch[]) {
  const wins = matches.filter((row) => row.outcome === "win").length;
  const losses = matches.filter((row) => row.outcome === "loss").length;
  const draws = matches.filter((row) => row.outcome === "draw").length;
  const scored = matches.filter((row) => row.outcome !== "unscored");
  const pointsFor = scored.reduce((sum, row) => sum + row.pointsFor!, 0);
  const pointsAgainst = scored.reduce(
    (sum, row) => sum + row.pointsAgainst!,
    0
  );
  return {
    wins,
    losses,
    draws,
    count: matches.length,
    scoredCount: scored.length,
    unscored: matches.length - scored.length,
    winRate: scored.length ? Math.round((wins / scored.length) * 100) : null,
    pointsFor,
    pointsAgainst,
    avgPointDiff: scored.length
      ? (pointsFor - pointsAgainst) / scored.length
      : null,
  };
}
export function buildPlayerPulse(
  rows: PulseMatchRow[],
  profile: PulseProfileInput,
  nowMs: number
): PlayerPulse {
  const unique = new Map<string, PulseMatchRow>();
  for (const row of rows) {
    if (
      !row.matchId ||
      (row.team !== 1 && row.team !== 2) ||
      !isValid(pulseDate(row.matchDate))
    )
      continue;
    unique.set(row.matchId, {
      ...row,
      ratingBefore: finite(row.ratingBefore) ? row.ratingBefore : null,
      ratingAfter: finite(row.ratingAfter) ? row.ratingAfter : null,
      ratingChange: finite(row.ratingChange) ? row.ratingChange : null,
    });
  }
  const matches: PulseMatch[] = [...unique.values()]
    .sort(byChrono)
    .map((row, index) => {
      const outcome = outcomeFor(row);
      const pointsFor =
        outcome === "unscored"
          ? null
          : row.team === 1
          ? row.team1Score
          : row.team2Score;
      const pointsAgainst =
        outcome === "unscored"
          ? null
          : row.team === 1
          ? row.team2Score
          : row.team1Score;
      return {
        ...row,
        index: index + 1,
        outcome,
        pointsFor,
        pointsAgainst,
        scoreLabel:
          outcome === "unscored"
            ? "Score unavailable"
            : `${pointsFor}–${pointsAgainst}`,
      };
    });
  const timeline: TimelinePoint[] = matches
    .filter((row) => row.ratingAfter !== null)
    .map((row) => ({
      matchId: row.matchId,
      date: row.matchDate,
      index: row.index,
      rating: row.ratingAfter!,
      ratingBefore: row.ratingBefore,
      ratingChange: row.ratingChange,
      outcome: row.outcome,
      scoreLabel: row.scoreLabel,
      source: row.source,
    }));
  const currentRating = finite(profile.currentRating)
    ? profile.currentRating
    : timeline.at(-1)?.rating ?? null;
  return {
    currentRating,
    matches,
    timeline,
    matchCount: matches.length,
    ratedMatchCount: timeline.length,
    missingSnapshotCount: matches.length - timeline.length,
    thirtyDayChange: computeThirtyDayChange(matches, nowMs),
    thirtyDayMatchCount: matches.filter((row) =>
      inDays(row.matchDate, 30, nowMs)
    ).length,
    confidence: computeConfidence(timeline.length),
    personalBest: computePersonalBest(matches, currentRating),
    asOf: nowMs,
  };
}
