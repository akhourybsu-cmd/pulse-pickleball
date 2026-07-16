/**
 * Slice 4 — canonical client-side rule for which schedule rows count toward
 * standings / stats / ratings.
 *
 * This mirrors the `round_robin_schedule_counted` DB view added in Slice 2a:
 * a row contributes ONLY if it is a real, played, still-canonical match —
 * not a bye, not voided, not superseded by a later row, not abandoned, and
 * with both final scores recorded.
 *
 * Before Slice 4 the client standings/kiosk/player views counted any scored
 * non-bye row, so an abandoned or superseded match (produced by participant
 * management — withdraw/abandon, restart-with-substitute, or a reoptimize that
 * voids stale rows) would wrongly keep contributing. This helper closes that
 * gap everywhere it is applied.
 *
 * Safe-by-construction: the guard fields are optional, so on a query that does
 * not select `voided_at` / `superseded_by_schedule_id` / `abandoned`, those
 * checks see `undefined` (falsy) and the row is treated exactly as before —
 * applying this helper can never change behaviour for a reader that lacks the
 * columns, only correct it for one that has them.
 */

export interface CountableScheduleRow {
  is_bye?: boolean | null;
  team1_score?: number | null;
  team2_score?: number | null;
  voided_at?: string | null;
  superseded_by_schedule_id?: string | null;
  abandoned?: boolean | null;
}

/** True when a schedule row's result should count toward standings/stats. */
export function countsTowardScore(row: CountableScheduleRow): boolean {
  return (
    row.is_bye !== true &&
    row.voided_at == null &&
    row.superseded_by_schedule_id == null &&
    row.abandoned !== true &&
    row.team1_score != null &&
    row.team2_score != null
  );
}
