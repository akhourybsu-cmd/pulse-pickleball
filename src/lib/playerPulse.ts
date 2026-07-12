/**
 * Player Pulse — analytics compute layer.
 *
 * Pure functions that turn a player's raw match-participant rows + profile
 * into the derived insights the /player/pulse screen renders. Kept separate
 * from data-fetching (see hooks/usePlayerPulse.ts) so the maths is testable
 * in isolation and reusable anywhere.
 *
 * Design rules baked in here (mirrors the product's "restraint" principle —
 * only assert what the data supports):
 *   - Verified matches only. Callers pass approved, non-voided rows.
 *   - Rating deltas come straight from match_participants.rating_change /
 *     rating_after, which the rating engine writes per match. We never
 *     recompute ratings — the engine owns that.
 *   - Insights (Momentum, personal best) return null / "Steady" states
 *     until there is enough data, so we don't call a two-close-game player
 *     a "Closer".
 *
 * This module deliberately does NOT touch the rating engine or any of its
 * SQL functions. It only reads the snapshots the engine already produced.
 */

import { didTeamWin } from "@/lib/matchDisplay";

/** Provisional threshold from the rating engine (rating_parameters.provisional_matches). */
export const PROVISIONAL_MATCHES = 8;

/** Minimum verified matches before we show a Momentum verdict at all. */
const MOMENTUM_MIN_MATCHES = 5;

/** How many recent matches "form" / momentum considers. */
const RECENT_WINDOW = 10;

/**
 * One row of a player's own participation in a match, already narrowed to
 * the fields Pulse needs. Shaped by the fetch layer from match_participants
 * joined to matches.
 */
export interface PulseMatchRow {
  matchId: string;
  /** ISO date string (matches.match_date). */
  matchDate: string;
  /** ISO timestamp (matches.created_at) — tiebreaker for same-day ordering. */
  createdAt: string;
  team: 1 | 2;
  team1Score: number;
  team2Score: number;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
  /** 'round_robin' | 'manual' | league etc. — used only for labelling. */
  source: string | null;
}

export type MomentumState = "rising" | "steady" | "recalibrating";

export type ConfidenceTier =
  | "provisional"
  | "developing"
  | "established"
  | "high";

export interface ConfidenceInfo {
  tier: ConfidenceTier;
  label: string;
  /** Short sentence explaining the tier. */
  detail: string;
  /** When not yet at the top tier, how to strengthen it. Null at "high". */
  nextStep: string | null;
  /** 0–1 progress toward the next tier boundary (for a progress bar). */
  progress: number;
}

export interface MomentumInfo {
  state: MomentumState;
  label: string;
  /** Human-readable supporting bullet points (already data-gated). */
  points: string[];
}

export interface TimelinePoint {
  matchId: string;
  /** ISO date. */
  date: string;
  /** Chronological index (1-based) — the x-axis for "by match". */
  index: number;
  /** Rating after this match. */
  rating: number;
  ratingChange: number | null;
  won: boolean;
  /** "11–8" style final score from the player's perspective (for / against). */
  scoreLabel: string;
  source: string | null;
}

export interface RecentImpact {
  matchId: string;
  date: string;
  won: boolean;
  scoreLabel: string;
  ratingChange: number | null;
  ratingAfter: number | null;
  source: string | null;
}

export interface PersonalBest {
  rating: number;
  /** ISO date the peak was reached. */
  date: string;
  /** True when the current rating equals the all-time peak. */
  isCurrent: boolean;
}

export interface PlayerPulse {
  /** Current headline rating (profiles.current_rating, falling back to last snapshot). */
  currentRating: number | null;
  /** Verified, rating-eligible match count used across the screen. */
  matchCount: number;
  wins: number;
  losses: number;
  winRate: number; // 0–100, integer
  /** Wins − losses point differential averaged per match, signed. Null if no scored matches. */
  avgPointDiff: number | null;
  /** Rating delta over the trailing 30 days. Null when there's no 30-day baseline. */
  thirtyDayChange: number | null;
  timeline: TimelinePoint[];
  recentImpacts: RecentImpact[];
  momentum: MomentumInfo | null;
  confidence: ConfidenceInfo;
  personalBest: PersonalBest | null;
  /** Record across the trailing RECENT_WINDOW matches, e.g. "6–4". Null if too few. */
  recentRecord: { wins: number; losses: number } | null;
}

export interface PulseProfileInput {
  currentRating: number | null;
  totalMatches: number | null;
  wins: number | null;
  losses: number | null;
}

/** Chronological sort: match_date, then created_at as a tiebreaker. */
function byChrono(a: PulseMatchRow, b: PulseMatchRow): number {
  if (a.matchDate !== b.matchDate) {
    return a.matchDate < b.matchDate ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return 0;
}

/** Score from the player's perspective: "11–8" (their team first). */
function scoreLabelFor(row: PulseMatchRow): string {
  const forScore = row.team === 1 ? row.team1Score : row.team2Score;
  const againstScore = row.team === 1 ? row.team2Score : row.team1Score;
  return `${forScore}–${againstScore}`;
}

function wonFor(row: PulseMatchRow): boolean {
  return didTeamWin(row.team, row.team1Score, row.team2Score);
}

/**
 * Confidence tier by verified match count. The 8-match line is the engine's
 * own provisional boundary; 20 marks a rating with enough history to be
 * trusted. This is intentionally about *how sure the number is*, not skill —
 * a 4.2 can be provisional and a 2.8 can be high-confidence.
 */
export function computeConfidence(matchCount: number): ConfidenceInfo {
  if (matchCount < 4) {
    return {
      tier: "provisional",
      label: "Provisional",
      detail: `Based on ${matchCount} verified ${matchCount === 1 ? "match" : "matches"}. Your rating can still swing quite a bit.`,
      nextStep: `Play ${4 - matchCount} more verified ${4 - matchCount === 1 ? "match" : "matches"} to start settling your rating.`,
      progress: matchCount / 4,
    };
  }
  if (matchCount < PROVISIONAL_MATCHES) {
    return {
      tier: "developing",
      label: "Developing",
      detail: `Based on ${matchCount} verified matches. Your rating is finding its level.`,
      nextStep: `Play ${PROVISIONAL_MATCHES - matchCount} more to reach an established rating.`,
      progress: (matchCount - 4) / (PROVISIONAL_MATCHES - 4),
    };
  }
  if (matchCount < 20) {
    return {
      tier: "established",
      label: "Established",
      detail: `Based on ${matchCount} verified matches. Your rating is stable.`,
      nextStep: `Reach ${20} verified matches for a high-confidence rating.`,
      progress: (matchCount - PROVISIONAL_MATCHES) / (20 - PROVISIONAL_MATCHES),
    };
  }
  return {
    tier: "high",
    label: "High confidence",
    detail: `Based on ${matchCount} verified matches. Your rating is well-anchored.`,
    nextStep: null,
    progress: 1,
  };
}

/**
 * Momentum verdict from recent rating movement. Returns null when there
 * aren't enough matches to say anything honest.
 *
 * - Rising: net positive rating change over the recent window AND more
 *   sessions up than down.
 * - Recalibrating: net negative (never labelled "Declining" — ratings
 *   naturally ebb and this framing keeps it constructive).
 * - Steady: essentially flat.
 */
export function computeMomentum(sorted: PulseMatchRow[]): MomentumInfo | null {
  const rated = sorted.filter((r) => r.ratingChange !== null);
  if (rated.length < MOMENTUM_MIN_MATCHES) return null;

  const recent = rated.slice(-RECENT_WINDOW);
  const net = recent.reduce((sum, r) => sum + (r.ratingChange ?? 0), 0);
  const ups = recent.filter((r) => (r.ratingChange ?? 0) > 0.0001).length;
  const downs = recent.filter((r) => (r.ratingChange ?? 0) < -0.0001).length;

  const recentWins = recent.filter(wonFor).length;
  const recentLosses = recent.length - recentWins;

  const points: string[] = [];
  points.push(`${recentWins}–${recentLosses} in your last ${recent.length} matches`);
  if (ups > 0) {
    points.push(`Rating rose in ${ups} of your last ${recent.length} matches`);
  }

  // Flat threshold: small net movement reads as "steady".
  const FLAT = 0.03;
  if (net > FLAT && ups >= downs) {
    return { state: "rising", label: "Rising", points };
  }
  if (net < -FLAT) {
    return { state: "recalibrating", label: "Recalibrating", points };
  }
  return { state: "steady", label: "Steady", points };
}

/**
 * Trailing 30-day rating change. Compares the latest rating_after against the
 * rating the player carried into the 30-day window (the rating_before of the
 * first match inside the window, or the rating_after of the last match before
 * it). Returns null when there is no pre-window baseline (brand-new players).
 *
 * `now` is injected (not read from Date) so the function stays pure/testable.
 */
export function computeThirtyDayChange(
  sorted: PulseMatchRow[],
  nowMs: number,
): number | null {
  const rated = sorted.filter((r) => r.ratingAfter !== null);
  if (rated.length === 0) return null;

  const latest = rated[rated.length - 1].ratingAfter!;
  const cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  // Baseline = rating_after of the last match strictly before the window.
  let baseline: number | null = null;
  for (const r of rated) {
    if (new Date(r.matchDate).getTime() < cutoffMs) {
      baseline = r.ratingAfter;
    } else {
      break;
    }
  }

  // No match before the window → fall back to the first in-window match's
  // rating_before, which is the rating they entered the window with.
  if (baseline === null) {
    const firstInWindow = sorted.find(
      (r) => new Date(r.matchDate).getTime() >= cutoffMs && r.ratingBefore !== null,
    );
    if (!firstInWindow || firstInWindow.ratingBefore === null) return null;
    baseline = firstInWindow.ratingBefore;
  }

  const delta = latest - baseline;
  // Suppress noise-level movement.
  return Math.abs(delta) < 0.0001 ? 0 : Number(delta.toFixed(2));
}

/** Peak rating_after across all matches, with the date it was reached. */
export function computePersonalBest(
  sorted: PulseMatchRow[],
  currentRating: number | null,
): PersonalBest | null {
  const rated = sorted.filter((r) => r.ratingAfter !== null);
  if (rated.length === 0) return null;

  let best = rated[0];
  for (const r of rated) {
    if ((r.ratingAfter ?? -Infinity) > (best.ratingAfter ?? -Infinity)) {
      best = r;
    }
  }
  const peak = best.ratingAfter!;
  const isCurrent =
    currentRating !== null && Math.abs(currentRating - peak) < 0.0001;

  return { rating: Number(peak.toFixed(2)), date: best.matchDate, isCurrent };
}

/**
 * Main entry point. Takes verified rows (approved, non-voided) + the player's
 * profile snapshot and returns the full Pulse view model.
 *
 * @param rows   match_participant rows for this player (any order)
 * @param profile profiles snapshot (current_rating, wins, losses, total_matches)
 * @param nowMs   current time in ms (injected for testability)
 */
export function buildPlayerPulse(
  rows: PulseMatchRow[],
  profile: PulseProfileInput,
  nowMs: number,
): PlayerPulse {
  const sorted = [...rows].sort(byChrono);

  // Timeline from rating snapshots. Skip rows with no rating_after (e.g. a
  // match the engine hasn't scored yet) so the line never dips to zero.
  const timeline: TimelinePoint[] = [];
  let idx = 0;
  for (const r of sorted) {
    if (r.ratingAfter === null) continue;
    idx += 1;
    timeline.push({
      matchId: r.matchId,
      date: r.matchDate,
      index: idx,
      rating: Number(r.ratingAfter.toFixed(2)),
      ratingChange: r.ratingChange,
      won: wonFor(r),
      scoreLabel: scoreLabelFor(r),
      source: r.source,
    });
  }

  // Record. Prefer the derived count from actual rows (authoritative for this
  // verified set); fall back to profile aggregates if rows are unexpectedly
  // sparse. Point differential is only computable from row scores.
  const derivedWins = sorted.filter(wonFor).length;
  const derivedLosses = sorted.length - derivedWins;
  const wins = sorted.length > 0 ? derivedWins : profile.wins ?? 0;
  const losses = sorted.length > 0 ? derivedLosses : profile.losses ?? 0;
  const matchCount =
    sorted.length > 0 ? sorted.length : profile.totalMatches ?? 0;
  const winRate =
    wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  const pointDiffs = sorted.map((r) => {
    const forScore = r.team === 1 ? r.team1Score : r.team2Score;
    const againstScore = r.team === 1 ? r.team2Score : r.team1Score;
    return forScore - againstScore;
  });
  const avgPointDiff =
    pointDiffs.length > 0
      ? Number(
          (pointDiffs.reduce((s, d) => s + d, 0) / pointDiffs.length).toFixed(1),
        )
      : null;

  const recentImpacts: RecentImpact[] = sorted
    .slice(-RECENT_WINDOW)
    .reverse()
    .map((r) => ({
      matchId: r.matchId,
      date: r.matchDate,
      won: wonFor(r),
      scoreLabel: scoreLabelFor(r),
      ratingChange: r.ratingChange,
      ratingAfter: r.ratingAfter,
      source: r.source,
    }));

  const recentSlice = sorted.slice(-RECENT_WINDOW);
  const recentRecord =
    recentSlice.length >= MOMENTUM_MIN_MATCHES
      ? {
          wins: recentSlice.filter(wonFor).length,
          losses: recentSlice.length - recentSlice.filter(wonFor).length,
        }
      : null;

  // Headline rating: profile value if present, else the last snapshot.
  const lastSnapshot =
    timeline.length > 0 ? timeline[timeline.length - 1].rating : null;
  const currentRating = profile.currentRating ?? lastSnapshot;

  return {
    currentRating,
    matchCount,
    wins,
    losses,
    winRate,
    avgPointDiff,
    thirtyDayChange: computeThirtyDayChange(sorted, nowMs),
    timeline,
    recentImpacts,
    momentum: computeMomentum(sorted),
    confidence: computeConfidence(matchCount),
    personalBest: computePersonalBest(sorted, currentRating),
    recentRecord,
  };
}

/** Filter a timeline to a requested range for the chart's period toggle. */
export type PulseRange = "last10" | "30d" | "90d" | "all";

export function filterTimeline(
  timeline: TimelinePoint[],
  range: PulseRange,
  nowMs: number,
): TimelinePoint[] {
  if (range === "all") return timeline;
  if (range === "last10") return timeline.slice(-10);
  const days = range === "30d" ? 30 : 90;
  const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000;
  return timeline.filter((p) => new Date(p.date).getTime() >= cutoffMs);
}
