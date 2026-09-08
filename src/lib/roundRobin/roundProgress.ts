import type { CountableScheduleRow } from './standings';

/** Abandoned games are resolved, not missing scores. History rows never block play. */
export function roundProgress(rows: CountableScheduleRow[]) {
  const matches = rows.filter(row => !row.is_bye && !row.voided_at && !row.superseded_by_schedule_id);
  const resolved = matches.filter(row => row.abandoned || (row.team1_score != null && row.team2_score != null)).length;
  return { total: matches.length, resolved, pending: matches.length - resolved, canClose: matches.length > 0 && resolved === matches.length };
}
