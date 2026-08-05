/**
 * Client-side placement status — decides how to LABEL a rating in the UI:
 * a "preliminary" estimate while a player is being placed vs their real
 * (placed/established) rating.
 *
 * Gated by PLACEMENT_UI_ENABLED so the framing stays dark until go-live.
 * Flip this the SAME time the server flag rating_parameters.placement_enabled
 * is enabled (see docs/placement-golive.md) — never before, or new players on
 * the current ELO would be mislabeled "preliminary" when their rating is real.
 */

/** Flip to true at go-live, together with the server placement_enabled flag. */
export const PLACEMENT_UI_ENABLED = false;

/** Matches needed to complete placement (mirrors rating_parameters). */
export const PLACEMENT_MATCHES = 5;
/** Matches needed to leave provisional. */
export const PROVISIONAL_MATCHES = 8;

export type PlacementUiState = "placing" | "provisional" | "established";

export interface PlacementStatus {
  state: PlacementUiState;
  /** Rating-eligible matches played so far. */
  played: number;
  /** Placement target (PLACEMENT_MATCHES). */
  total: number;
  /** Matches left to complete placement (0 once placed). */
  remaining: number;
  /** True while the shown number is a preliminary placement estimate. */
  isPreliminary: boolean;
}

export function placementStatus(totalMatches: number | null | undefined): PlacementStatus {
  const played = Math.max(0, totalMatches ?? 0);
  let state: PlacementUiState = "established";
  if (PLACEMENT_UI_ENABLED && played < PLACEMENT_MATCHES) state = "placing";
  else if (played < PROVISIONAL_MATCHES) state = "provisional";
  return {
    state,
    played,
    total: PLACEMENT_MATCHES,
    remaining: Math.max(0, PLACEMENT_MATCHES - played),
    isPreliminary: state === "placing",
  };
}
