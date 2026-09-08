export interface SubRequest {
  id: string; league_id: string; season_id: string; session_id: string;
  week_number: number; player_id: string; note: string | null;
  status: 'pending' | 'sub' | 'sitout' | 'declined' | 'canceled';
  assigned_sub_id: string | null; resolution_note?: string | null;
  created_at: string; updated_at: string;
}

export interface SubRequestWeek {
  id: string; week_number: number | null; scheduled_date: string | null;
  start_time: string | null; location: string | null; status: string;
}

/** Match the database's CURRENT_DATE boundary (UTC), without parsing date-only
 * strings as instants and shifting their displayed day in the user's timezone. */
export function requestableWeeks(weeks: SubRequestWeek[], generated: Set<number>, today: string) {
  return weeks.filter(w => w.week_number != null && w.week_number >= 2
    && w.status === 'published' && (!w.scheduled_date || w.scheduled_date >= today)
    && !generated.has(w.week_number));
}

export function eligibleSubIds(ids: string[], order: string[], requests: SubRequest[], request: SubRequest, sitouts: string[] = []) {
  const unavailable = new Set([...order, ...sitouts, request.player_id]);
  for (const other of requests) {
    if (other.session_id !== request.session_id) continue;
    if (other.status === 'sub' && other.assigned_sub_id) unavailable.add(other.assigned_sub_id);
    if (['pending', 'sub', 'sitout'].includes(other.status)) unavailable.add(other.player_id);
  }
  return [...new Set(ids)].filter(id => !unavailable.has(id));
}

export function subRequestStatus(status: SubRequest['status']) {
  return { pending: 'Awaiting organizer', sub: 'Substitute arranged', sitout: 'Sitting out',
    declined: 'Not arranged', canceled: 'Canceled' }[status];
}

export function weekDescription(week: SubRequestWeek) {
  const date = week.scheduled_date ? new Date(`${week.scheduled_date}T00:00:00`).toLocaleDateString(undefined,
    { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date to be confirmed';
  return `Week ${week.week_number} · ${date}${week.start_time ? ` · ${week.start_time.slice(0, 5)}` : ''}`;
}
