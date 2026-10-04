import { format, isToday, isTomorrow, isValid, parseISO } from "date-fns";

interface MatchTime {
  scheduled_time: string | null;
  has_match_time?: boolean;
  session_date?: string | null;
  session_start_time?: string | null;
}

/** Session times are venue-local wall-clock values, just like the league schedule. */
export function upcomingLeagueDate(match: MatchTime): Date | null {
  const raw =
    match.has_match_time === false
      ? match.session_date &&
        `${match.session_date}T${match.session_start_time || "00:00:00"}`
      : match.scheduled_time;
  const date = raw ? parseISO(raw) : null;
  return date && isValid(date) ? date : null;
}

export function upcomingLeagueWhen(match: MatchTime): string {
  const date = upcomingLeagueDate(match);
  if (!date) return "Time to be announced";
  const day = isToday(date)
    ? "Today"
    : isTomorrow(date)
    ? "Tomorrow"
    : format(date, "EEE MMM d");
  const time =
    match.has_match_time === false && !match.session_start_time
      ? "Time to be announced"
      : format(date, "h:mm a");
  return `${day} · ${time}`;
}
