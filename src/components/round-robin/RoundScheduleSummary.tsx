import type { StandingsSeatRow } from "@/lib/roundRobin/standings";
import {
  restingPlayers,
  roundScheduleSummary,
  type ScheduleSeat,
} from "@/lib/roundRobin/scheduleDisplay";
import "./event.css";

export function RestingPlayers<T extends StandingsSeatRow>({
  matches,
  seatName,
}: {
  matches: T[];
  seatName: (match: T, seat: ScheduleSeat) => string;
}) {
  const players = restingPlayers(matches);
  if (!players.length) return null;
  return (
    <section
      className="rounded-xl border border-border bg-muted/30 p-4"
      aria-label="Players resting this round"
    >
      <h3 className="text-xs font-semibold">
        Resting this round · {players.length}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A rest does not count as a played game.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {players.map((player) => (
          <span
            key={player.id}
            className="max-w-full break-words rounded-lg border border-border bg-card px-3 py-2 text-xs"
          >
            {seatName(player.match, player.seat)}
          </span>
        ))}
      </div>
    </section>
  );
}

export function RoundScheduleSummary({
  matches,
  round,
  currentRound,
  status,
}: {
  matches: StandingsSeatRow[];
  round: number;
  currentRound: number;
  status: string;
}) {
  const summary = roundScheduleSummary(matches);
  const label =
    status === "voided"
      ? "Event voided"
      : status === "completed"
      ? "Event complete"
      : status === "draft"
      ? "Planned round"
      : round === currentRound
      ? "Current round"
      : round > currentRound
      ? "Upcoming round"
      : "Previous round";
  return (
    <div className="rr-round-summary" aria-label={`Round ${round} summary`}>
      <strong
        className={
          status === "live" && round === currentRound ? "text-primary" : ""
        }
      >
        {label}
      </strong>
      <span>
        {summary.scored} of {summary.games}{" "}
        {summary.games === 1 ? "game" : "games"} scored
      </span>
      {summary.resolved > 0 && <span>{summary.resolved} without a result</span>}
      <span>{summary.resting} resting</span>
    </div>
  );
}
