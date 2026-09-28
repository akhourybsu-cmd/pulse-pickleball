import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventSchedule } from "@/lib/venues/eventPresentation";
import { formatMoney } from "@/lib/payments";
import {
  type VenueRoundRobin,
  venueRoundRobinHref,
} from "@/lib/venues/competitions";

export function VenueRoundRobinCard({
  event: e,
  groupId,
  timezone,
  busy,
  onSetup,
}: {
  event: VenueRoundRobin;
  groupId: string;
  timezone: string | null;
  busy: boolean;
  onSetup: () => void;
}) {
  const schedule = eventSchedule(e.start_time, e.end_time, timezone);
  const closed =
    !!e.canceled_at || e.status === "voided" || e.status === "completed";
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="h-1 bg-emerald-500/70" />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <span className="text-xs font-bold uppercase">{schedule?.month}</span>
          <span className="text-3xl font-bold">{schedule?.day}</span>
          <span className="text-xs">{schedule?.weekday}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {e.canceled_at
                ? "Canceled"
                : e.status === "voided"
                ? "Voided"
                : e.status === "completed"
                ? "Completed"
                : e.status === "live"
                ? "Live play"
                : e.roster_locked_at
                ? "Ready for matches"
                : e.round_robin_id
                ? "Signups syncing"
                : "Ready to set up"}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{e.title}</h2>
          </div>
          <p className="text-sm font-medium">
            <CalendarDays className="mr-2 inline h-4 w-4" />
            {schedule?.label}
            <br />
            <span className="ml-6">
              {schedule?.time} {schedule?.zone}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {e.courts
              .map(
                (c, i) =>
                  `Play court ${i + 1}: ${c.name || `Court ${c.court_number}`}`
              )
              .join(" · ") || "Courts released"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <span>
              <Users className="mr-1 inline h-4 w-4" />
              {e.confirmed}
              {e.capacity ? ` / ${e.capacity}` : ""} confirmed
            </span>
            <span>
              {e.price_cents
                ? `${formatMoney(e.price_cents)} / player`
                : "Free registration"}
            </span>
            <span>{e.games_per_player} games / player</span>
          </div>
          {!!e.roster_locked_at &&
            !!(e.roster_additions || e.roster_withdrawals) &&
            !closed && (
              <p
                role="status"
                className="rounded-lg bg-amber-500/10 p-3 text-sm"
              >
                Registration changed after preparation: {e.roster_additions}{" "}
                addition(s), {e.roster_withdrawals} withdrawal(s). Review the
                playing roster before continuing.
              </p>
            )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-48 sm:flex-col">
          {e.round_robin_id ? (
            <Button asChild>
              <Link to={venueRoundRobinHref(groupId, e.round_robin_id)}>
                <Trophy className="mr-2 h-4 w-4" />
                {closed ? "View round robin" : "Manage round robin"}
              </Link>
            </Button>
          ) : (
            !closed &&
            new Date(e.end_time) > new Date() && (
              <Button disabled={busy} onClick={onSetup}>
                <Trophy className="mr-2 h-4 w-4" />
                Set up round robin
              </Button>
            )
          )}
          <Button variant="outline" asChild>
            <Link
              to={`/player/community/group/${groupId}/events/manage?event=${e.id}`}
            >
              Event & registrations
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
