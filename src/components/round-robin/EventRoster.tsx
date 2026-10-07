import { useMemo, useState, type ReactNode } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  EventStanding,
  ViewPlayer,
} from "@/lib/roundRobin/playerEventSnapshot";
import "./event.css";

function eventPlayerName(player: ViewPlayer) {
  return (
    player.profiles?.display_name ||
    player.profiles?.full_name ||
    player.guest_display_name ||
    (player.is_guest ? "Guest" : "Player")
  );
}

export function EventRoster({
  players,
  standings,
  myIds = new Set<string>(),
  action,
  playerActions,
  searchTerm,
  onSearchTermChange,
}: {
  players: ViewPlayer[];
  standings: EventStanding[];
  myIds?: Set<string>;
  action?: ReactNode;
  playerActions?: (player: ViewPlayer) => ReactNode;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const currentSearch = searchTerm ?? search;
  const stats = useMemo(
    () => new Map(standings.map((row) => [row.playerId, row])),
    [standings]
  );
  const groups = [
    {
      key: "active",
      title: "Active roster",
      hint: "Players currently in the event.",
    },
    {
      key: "waitlisted",
      title: "Waitlist",
      hint: "Waiting for a roster spot; not included in the active player count.",
    },
    {
      key: "removed",
      title: "No longer playing",
      hint: "Past participation and recorded scores remain in event history.",
    },
  ] as const;
  const query = currentSearch.trim().toLocaleLowerCase();
  const matches = players.filter((player) =>
    eventPlayerName(player).toLocaleLowerCase().includes(query)
  );
  return (
    <section className="rr-data-panel" aria-label="Event players">
      <header className="rr-data-heading">
        <div className="rr-data-heading-row">
          <div>
            <div className="rr-data-eyebrow">
              <Users aria-hidden="true" />
              The roster
            </div>
            <h2>Players</h2>
          </div>
          {action}
        </div>
        <p>
          {players.filter((p) => p.rosterStatus === "active").length} active ·{" "}
          {players.filter((p) => p.rosterStatus === "waitlisted").length}{" "}
          waitlisted ·{" "}
          {players.filter((p) => p.rosterStatus === "removed").length} no longer
          playing
        </p>
        <div className="relative mt-4">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search event players"
            placeholder="Find a player or guest…"
            value={currentSearch}
            onChange={(event) =>
              (onSearchTermChange ?? setSearch)(event.target.value)
            }
            className="pl-10"
          />
        </div>
      </header>
      {groups.map((group) => {
        const groupPlayers = matches
          .filter((player) => player.rosterStatus === group.key)
          .sort((a, b) => eventPlayerName(a).localeCompare(eventPlayerName(b)));
        if (!groupPlayers.length) return null;
        return (
          <section
            key={group.key}
            className="rr-roster-group"
            aria-label={group.title}
          >
            <div className="rr-roster-group-heading">
              <h3>
                {group.title}
                <span>{groupPlayers.length}</span>
              </h3>
              <p>{group.hint}</p>
            </div>
            <div className="rr-roster-grid">
              {groupPlayers.map((player) => {
                const name = eventPlayerName(player);
                const record = stats.get(player.player_id);
                return (
                  <article
                    key={player.player_id}
                    className={`rr-roster-person ${
                      myIds.has(player.player_id) ? "rr-roster-you" : ""
                    }`}
                  >
                    <div className="rr-roster-identity">
                      <Avatar className="h-10 w-10 shrink-0">
                        {player.profiles?.avatar_url && (
                          <AvatarImage
                            src={player.profiles.avatar_url}
                            alt=""
                          />
                        )}
                        <AvatarFallback>
                          {name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h4>{name}</h4>
                        <div className="rr-roster-tags">
                          {myIds.has(player.player_id) && (
                            <span className="rr-person-tag">You</span>
                          )}
                          {player.is_guest && !player.guest_linked_user_id && (
                            <span className="rr-person-tag">Guest</span>
                          )}
                          {player.is_guest && player.guest_linked_user_id && (
                            <span className="rr-person-tag">PULSE account</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rr-roster-record">
                      {record?.gamesPlayed ? (
                        <>
                          <strong>
                            {record.wins}W – {record.losses}L
                          </strong>
                          <span>
                            {record.gamesPlayed}{" "}
                            {record.gamesPlayed === 1 ? "game" : "games"} played
                          </span>
                        </>
                      ) : (
                        <span>
                          {group.key === "waitlisted"
                            ? "Awaiting a roster spot"
                            : "No recorded games"}
                        </span>
                      )}
                      {player.profiles?.current_rating != null && (
                        <span>
                          PULSE{" "}
                          {Number(player.profiles.current_rating).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {playerActions && (
                      <div className="rr-roster-actions">
                        {playerActions(player)}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      {!matches.length && (
        <div className="rr-data-empty">
          <Users aria-hidden="true" />
          <h3>{query ? "No matching players" : "No players yet"}</h3>
          <p>
            {query
              ? "Try a different name."
              : "Players and guests will appear here when added to the event."}
          </p>
        </div>
      )}
    </section>
  );
}
