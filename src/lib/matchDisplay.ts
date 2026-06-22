/**
 * Shared match-card display helpers.
 *
 * Every surface that renders a match (MatchHistory, ViewProfile, Dashboard
 * PerformanceModule, RoundRobinMatchGroup) must go through these helpers so
 * the same match always shows the same player name, win/loss state, and
 * rating delta — regardless of where it appears.
 */

export interface MinimalProfile {
  display_name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * Canonical player-name resolver.
 *
 * Fallback order is deliberate and identical everywhere:
 *   display_name → full_name → "first last" → "Removed player"
 *
 * Never returns the literal string "Unknown" — that string used to leak
 * onto match cards when a profile join came back null (deleted user / RLS).
 */
export function resolvePlayerName(profile: MinimalProfile | null | undefined): string {
  if (!profile) return "Removed player";
  const display = profile.display_name?.trim();
  if (display) return display;
  const full = profile.full_name?.trim();
  if (full) return full;
  const composed = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  if (composed) return composed;
  return "Removed player";
}

/** Two-letter avatar initials. Safe on empty / single-word names. */
export function resolvePlayerInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

/**
 * Score-based win determination.
 *
 * Previously MatchHistory used `rating_change > 0`, which mis-labelled
 * any match where the participant's rating change was null or exactly
 * zero — those rendered as losses even when the score was higher.
 */
export function didTeamWin(team: 1 | 2, team1Score: number, team2Score: number): boolean {
  if (team === 1) return team1Score > team2Score;
  return team2Score > team1Score;
}

/** Format a rating delta as "+0.12" / "−0.08", or null when effectively zero. */
export function formatRatingChange(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined) return null;
  if (Math.abs(delta) <= 0.0001) return null;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;
}
