import { Trophy } from "lucide-react";
import { RankBadge } from "./RankBadge";
import type { EventStanding } from "@/lib/roundRobin/playerEventSnapshot";
import "./event.css";

export function EventStandings({
  rows,
  completed = false,
  voided = false,
  myIds = new Set<string>(),
}: {
  rows: EventStanding[];
  completed?: boolean;
  voided?: boolean;
  myIds?: Set<string>;
}) {
  const ranked = rows.filter((row) => !row.isRemoved && row.gamesPlayed > 0);
  const waiting = rows.filter((row) => !row.isRemoved && row.gamesPlayed === 0);
  const removed = rows.filter((row) => row.isRemoved);
  const hasResults = rows.some((row) => row.gamesPlayed > 0);
  const renderRow = (row: EventStanding, rank?: number) => {
    const diff = row.pointsFor - row.pointsAgainst;
    return (
      <tr
        key={row.playerId}
        className={myIds.has(row.playerId) ? "rr-standing-you" : undefined}
      >
        <td>
          {rank && !voided ? (
            <RankBadge rank={rank} />
          ) : (
            <span className="text-muted-foreground" aria-label="Unranked">
              —
            </span>
          )}
        </td>
        <th scope="row">
          <span className="rr-standing-name">
            {row.playerName}
            {myIds.has(row.playerId) && (
              <span className="rr-person-tag">You</span>
            )}
          </span>
          <span className="rr-standing-points">
            {row.pointsFor} for · {row.pointsAgainst} against
          </span>
        </th>
        <td>{row.gamesPlayed}</td>
        <td>
          <span className="font-semibold">{row.wins}</span>
          <span className="text-muted-foreground">–{row.losses}</span>
        </td>
        <td className="rr-standing-detail">{row.pointsFor}</td>
        <td className="rr-standing-detail">{row.pointsAgainst}</td>
        <td
          className={diff > 0 ? "text-primary font-semibold" : "font-semibold"}
        >
          {diff > 0 ? "+" : ""}
          {diff}
        </td>
      </tr>
    );
  };
  return (
    <section className="rr-data-panel" aria-label="Event standings">
      <header className="rr-data-heading">
        <div className="rr-data-eyebrow">
          <Trophy aria-hidden="true" />
          {voided
            ? "Voided event"
            : completed
            ? "Final results"
            : "Event leaderboard"}
        </div>
        <h2>
          {voided
            ? "Historical results"
            : completed
            ? "Final standings"
            : "Standings"}
        </h2>
        <p>
          {voided
            ? "This event was voided. Historical scores are shown without rankings."
            : "Based on saved match scores. Rest rounds and removed results do not count."}
        </p>
      </header>
      {!hasResults && (
        <div className="rr-data-empty">
          <Trophy aria-hidden="true" />
          <h3>No results yet</h3>
          <p>Rankings appear after the first match score is saved.</p>
        </div>
      )}
      {rows.length > 0 && (
        <div className="rr-standings-scroll">
          <table className="rr-standings-table">
            <caption className="sr-only">
              Event standings with games played, wins, losses, and points
            </caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col" aria-label="Games played">
                  GP
                </th>
                <th scope="col" aria-label="Wins and losses">
                  W–L
                </th>
                <th
                  scope="col"
                  className="rr-standing-detail"
                  aria-label="Points for"
                >
                  PF
                </th>
                <th
                  scope="col"
                  className="rr-standing-detail"
                  aria-label="Points against"
                >
                  PA
                </th>
                <th scope="col" aria-label="Point difference">
                  +/−
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => renderRow(row, index + 1))}
              {waiting.length > 0 && (
                <tr className="rr-standing-group">
                  <th colSpan={7} scope="colgroup">
                    Awaiting first result · {waiting.length}
                  </th>
                </tr>
              )}
              {waiting.map((row) => renderRow(row))}
              {removed.length > 0 && (
                <tr className="rr-standing-group">
                  <th colSpan={7} scope="colgroup">
                    No longer on the active roster · {removed.length}
                    <span>
                      Recorded results are retained; these players are not
                      ranked.
                    </span>
                  </th>
                </tr>
              )}
              {removed.map((row) => renderRow(row))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="rr-data-footnote">
        <p>
          <strong>Ranking order:</strong> wins, point difference, points scored,
          then alphabetical name.
        </p>
        <p>
          GP = games played · W–L = wins–losses · PF/PA = points for/against ·
          +/− = point difference.
        </p>
      </footer>
    </section>
  );
}
