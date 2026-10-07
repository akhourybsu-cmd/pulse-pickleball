import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { kioskClient as supabase } from "@/integrations/supabase/kioskClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  LogOut,
  Pause,
  Play,
  Radio,
  Trophy,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { FullscreenToggleButton } from "@/components/kiosk/FullscreenToggleButton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  countsTowardScore,
  resolvedMatchLabel,
  type CanonicalStandingsRow,
} from "@/lib/roundRobin/standings";
import { fetchRoundRobinKioskSnapshot } from "@/lib/roundRobin/kioskData";
import { roundProgress } from "@/lib/roundRobin/roundProgress";
import "@/components/round-robin/kiosk.css";

type KioskTheme = "proBroadcast" | "courtGreen" | "oceanBlue" | "pulseLight";

const THEME_CONFIG = {
  proBroadcast: {
    name: "Pro Broadcast",
    bg: "#1C2127",
    headerBg: "#151a1f",
    cardBg: "#23282f",
    accent: "#FFB627",
    accentRgb: "255, 182, 39",
    text: "#ffffff",
    mutedText: "#9ca3af",
    rowBg: "rgba(255,255,255,0.03)",
    chipBg: "rgba(255,255,255,0.08)",
    divider: "rgba(255,255,255,0.15)",
    cardShadow:
      "0 10px 34px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  courtGreen: {
    name: "Court Green",
    bg: "#0a1a0a",
    headerBg: "#0d1f0d",
    cardBg: "#1a2e1a",
    accent: "#A6DB5A",
    accentRgb: "166, 219, 90",
    text: "#ffffff",
    mutedText: "#94a3b8",
    rowBg: "rgba(255,255,255,0.03)",
    chipBg: "rgba(255,255,255,0.08)",
    divider: "rgba(255,255,255,0.15)",
    cardShadow:
      "0 10px 34px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  oceanBlue: {
    name: "Ocean Blue",
    bg: "#0a1929",
    headerBg: "#0d1f33",
    cardBg: "#1a2942",
    accent: "#3b82f6",
    accentRgb: "59, 130, 246",
    text: "#ffffff",
    mutedText: "#94a3b8",
    rowBg: "rgba(255,255,255,0.03)",
    chipBg: "rgba(255,255,255,0.08)",
    divider: "rgba(255,255,255,0.15)",
    cardShadow:
      "0 10px 34px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  pulseLight: {
    name: "Pulse Light",
    bg: "#F4F6F4",
    headerBg: "#FFFFFF",
    cardBg: "#FFFFFF",
    accent: "#0D7A5F",
    accentRgb: "13, 122, 95",
    text: "#0A1F1A",
    mutedText: "#55665F",
    rowBg: "rgba(13,122,95,0.05)",
    chipBg: "rgba(13,122,95,0.12)",
    divider: "rgba(10,31,26,0.15)",
    cardShadow:
      "0 10px 30px rgba(10,31,26,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
  },
};

type Snapshot = NonNullable<
  Awaited<ReturnType<typeof fetchRoundRobinKioskSnapshot>>
>;
type Match = Snapshot["schedule"][number];
type Seat = "a1" | "a2" | "b1" | "b2";

function seatName(match: Match, seat: Seat) {
  return (
    match[`${seat}_profile`]?.display_name ||
    match[`${seat}_guest`]?.display_name ||
    (match[`${seat}_player_id`] || match[`${seat}_guest_id`]
      ? "Player"
      : "Awaiting player")
  );
}

/** Each broadcast section cycles independently; manual navigation pauses cycling. */
function Pages<T>({
  items,
  size,
  label,
  cycling,
  onPause,
  children,
}: {
  items: T[];
  size: number;
  label: string;
  cycling: boolean;
  onPause: () => void;
  children: (items: T[], offset: number) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const count = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, count - 1);
  useEffect(() => {
    if (!cycling || count < 2) return;
    const timer = setInterval(
      () => setPage((value) => (Math.min(value, count - 1) + 1) % count),
      15_000
    );
    return () => clearInterval(timer);
  }, [cycling, count]);
  const move = (delta: number) => {
    onPause();
    setPage((current + delta + count) % count);
  };
  return (
    <>
      {children(
        items.slice(current * size, (current + 1) * size),
        current * size
      )}
      {count > 1 && (
        <nav className="rr-kiosk-pages" aria-label={`${label} pages`}>
          <button
            aria-label={`Previous ${label} page`}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {label} · {current + 1} / {count}
          </span>
          <button aria-label={`Next ${label} page`} onClick={() => move(1)}>
            <ChevronRight size={18} />
          </button>
        </nav>
      )}
    </>
  );
}

function Resting({ players }: { players: Snapshot["resting"] }) {
  if (!players.length) return null;
  return (
    <div className="rr-kiosk-rest">
      <strong>
        <Coffee size={17} /> Resting · {players.length}
      </strong>
      <p>
        {players.map(({ match, seat }) => seatName(match, seat)).join(" · ")}
      </p>
    </div>
  );
}

function Court({
  match,
  upcoming = false,
}: {
  match: Match;
  upcoming?: boolean;
}) {
  const scored = countsTowardScore(match);
  const assigned = (["a1", "a2", "b1", "b2"] as const).every(
    (seat) => match[`${seat}_player_id`] || match[`${seat}_guest_id`]
  );
  const label =
    resolvedMatchLabel(match) ??
    (scored
      ? "Final"
      : !assigned
      ? "Awaiting players"
      : upcoming
      ? "Next up"
      : "Awaiting score");
  return (
    <article
      className={`rr-kiosk-court${upcoming ? " rr-kiosk-court-next" : ""}`}
      aria-label={`Round ${match.round_no}, Court ${match.court_no}`}
    >
      <header>
        <h3>Court {match.court_no}</h3>
        <span>{label}</span>
      </header>
      {(
        [
          ["a1", "a2"],
          ["b1", "b2"],
        ] as const
      ).map((seats, index) => {
        const score = index === 0 ? match.team1_score : match.team2_score;
        const other = index === 0 ? match.team2_score : match.team1_score;
        return (
          <div
            key={index}
            className="rr-kiosk-team"
            data-winner={scored && score! > other!}
          >
            <div>
              <small>Team {index + 1}</small>
              {seats.map((seat) => (
                <p key={seat}>{seatName(match, seat)}</p>
              ))}
            </div>
            {scored && (
              <strong aria-label={`Team ${index + 1} score ${score}`}>
                {score}
              </strong>
            )}
          </div>
        );
      })}
    </article>
  );
}

function Ranking({
  rows,
  offset,
}: {
  rows: CanonicalStandingsRow[];
  offset: number;
}) {
  return (
    <table className="rr-kiosk-ranking">
      <caption className="sr-only">
        Active players with recorded games, ordered by wins, point difference,
        then points for
      </caption>
      <thead>
        <tr>
          <th scope="col">Rank / Player</th>
          <th scope="col">GP</th>
          <th scope="col">W–L</th>
          <th scope="col">
            <abbr title="Point difference">+/−</abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.key}>
            <th scope="row">
              <span className="rr-kiosk-rank">{offset + index + 1}</span>
              {row.name}
            </th>
            <td>{row.gamesPlayed}</td>
            <td>
              {row.wins}–{row.losses}
            </td>
            <td>
              {row.pointDiff > 0 ? "+" : ""}
              {row.pointDiff}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RoundRobinKiosk() {
  const { id: eventId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["round-robin-kiosk", eventId], [eventId]);
  const snapshot = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      fetchRoundRobinKioskSnapshot(supabase, eventId!, signal),
    enabled: !!eventId,
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [exitOpen, setExitOpen] = useState(false);
  const [cycling, setCycling] = useState(true);
  const [roomyDisplay, setRoomyDisplay] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 901px) and (min-height: 1000px)").matches
  );
  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 901px) and (min-height: 1000px)"
    );
    const update = () => setRoomyDisplay(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [theme, setTheme] = useState<KioskTheme>(() => {
    try {
      const saved = localStorage.getItem("kioskTheme");
      return saved && Object.prototype.hasOwnProperty.call(THEME_CONFIG, saved)
        ? (saved as KioskTheme)
        : "proBroadcast";
    } catch {
      return "proBroadcast";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("kioskTheme", theme);
    } catch {
      /* Storage is optional. */
    }
  }, [theme]);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!eventId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries(
          { queryKey },
          { cancelRefetch: false }
        );
      }, 180);
    };
    const channel = supabase
      .channel(`kiosk-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "round_robin_events",
          filter: `id=eq.${eventId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "round_robin_schedule",
          filter: `event_id=eq.${eventId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "round_robin_players",
          filter: `event_id=eq.${eventId}`,
        },
        refresh
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [eventId, queryClient, queryKey]);

  const colors = THEME_CONFIG[theme];
  const style = {
    "--kiosk-bg": colors.bg,
    "--kiosk-card": colors.cardBg,
    "--kiosk-header": colors.headerBg,
    "--kiosk-accent": colors.accent,
    "--kiosk-accent-rgb": colors.accentRgb,
    "--kiosk-text": colors.text,
    "--kiosk-muted": colors.mutedText,
    "--kiosk-line": colors.divider,
  } as CSSProperties;
  const data = snapshot.data;
  const event = data?.event;
  const reconnecting =
    snapshot.isError ||
    snapshot.fetchStatus === "paused" ||
    (snapshot.dataUpdatedAt > 0 &&
      currentTime.getTime() - snapshot.dataUpdatedAt > 30_000);
  const retry = () => {
    void snapshot.refetch({ cancelRefetch: false });
  };
  const complete = event?.status === "completed";
  const currentRound = event?.current_round || 1;
  const progress = roundProgress(data?.current ?? []);
  const pause = () => setCycling(false);
  const ticker = !data
    ? ""
    : !data.current.length
    ? "Waiting for saved court assignments"
    : !progress.canClose
    ? `${progress.pending} court${
        progress.pending === 1 ? "" : "s"
      } awaiting a result`
    : data.nextRound
    ? `Courts resolved · Waiting for the host to start round ${data.nextRound}`
    : "Courts resolved · Waiting for the host to complete the event";
  const leave = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => undefined);
    navigate(`/round-robin/${eventId}`);
  };

  return (
    <div className="rr-kiosk" style={style}>
      <header className="rr-kiosk-header">
        <Logo className="rr-kiosk-logo" />
        <div className="rr-kiosk-title">
          <p>PULSE / ROUND ROBIN</p>
          <h1>{event?.name ?? "Courtside display"}</h1>
          {event?.location && <span>{event.location}</span>}
        </div>
        <div className="rr-kiosk-status">
          <Radio size={15} />
          {reconnecting
            ? "Reconnecting"
            : complete
            ? "Event complete"
            : event
            ? `Live · Round ${currentRound}`
            : "Kiosk"}
        </div>
        <time>
          {currentTime.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
      </header>
      <div className="rr-kiosk-toolbar" aria-label="Display controls">
        <label>
          Theme{" "}
          <select
            aria-label="Display theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as KioskTheme)}
          >
            {(Object.keys(THEME_CONFIG) as KioskTheme[]).map((value) => (
              <option key={value} value={value}>
                {THEME_CONFIG[value].name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setCycling((value) => !value)}
          aria-pressed={!cycling}
        >
          {cycling ? <Pause size={15} /> : <Play size={15} />}
          {cycling ? "Pause cycling" : "Resume cycling"}
        </button>
        <FullscreenToggleButton inline />
        <button onClick={() => setExitOpen(true)}>
          <LogOut size={15} /> Exit kiosk
        </button>
      </div>
      {reconnecting && (
        <div role="status" className="rr-kiosk-connection">
          <span>
            {data
              ? `Connection interrupted · Showing last saved scores from ${new Date(
                  snapshot.dataUpdatedAt
                ).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}.`
              : "Connection interrupted · Retrying automatically."}
          </span>
          <button disabled={snapshot.isFetching} onClick={retry}>
            {snapshot.isFetching ? "Reconnecting…" : "Retry"}
          </button>
        </div>
      )}
      {!data ? (
        <main className="rr-kiosk-empty" role="status">
          <Radio size={36} />
          <h2>
            {snapshot.isPending && snapshot.fetchStatus !== "paused"
              ? "Loading courtside display…"
              : reconnecting
              ? "Reconnecting to the event"
              : "Event unavailable"}
          </h2>
          <p>
            {reconnecting
              ? "The display will recover automatically when the connection returns."
              : "Public scores are available while an event is live or completed."}
          </p>
          {!snapshot.isPending && (
            <button onClick={retry} disabled={snapshot.isFetching}>
              Try again
            </button>
          )}
        </main>
      ) : complete ? (
        <main className="rr-kiosk-final">
          <div className="rr-kiosk-celebration">
            <Trophy size={30} />
            <div>
              <p>FINAL STANDINGS</p>
              <h2>
                {data.standings.length
                  ? "A round of applause."
                  : "Thanks for playing."}
              </h2>
            </div>
          </div>
          {data.standings.length > 0 && (
            <div className="rr-kiosk-podium">
              {data.standings.slice(0, 3).map((row, index) => (
                <article key={row.key} data-rank={index + 1}>
                  <span>
                    {index === 0
                      ? "Champion"
                      : index === 1
                      ? "2nd place"
                      : "3rd place"}
                  </span>
                  <strong>{row.name}</strong>
                  <p>
                    {row.wins}W · {row.losses}L · {row.gamesPlayed} games
                  </p>
                </article>
              ))}
            </div>
          )}
          <section className="rr-kiosk-section">
            <h2>Final leaderboard</h2>
            {data.standings.length ? (
              <Pages
                key={eventId}
                items={data.standings}
                size={roomyDisplay ? 6 : 3}
                label="Standings"
                cycling={cycling}
                onPause={pause}
              >
                {(rows, offset) => <Ranking rows={rows} offset={offset} />}
              </Pages>
            ) : (
              <p className="rr-kiosk-note">
                No ranked results. Players need a recorded game and an active
                place on the roster to be ranked.
              </p>
            )}
            <p className="rr-kiosk-note">
              Ranked by wins, point difference, then points for.
              {data.removedCount > 0
                ? ` ${data.removedCount} former player${
                    data.removedCount === 1 ? " remains" : "s remain"
                  } in event history.`
                : ""}
            </p>
          </section>
        </main>
      ) : (
        <main className="rr-kiosk-main">
          <section className="rr-kiosk-live">
            <div className="rr-kiosk-heading">
              <div>
                <p>ON COURT</p>
                <h2>Round {currentRound}</h2>
              </div>
              <span>
                {progress.resolved} / {progress.total} courts resolved
              </span>
            </div>
            <Pages
              key={`${eventId}-${currentRound}`}
              items={data.current}
              size={roomyDisplay ? 4 : 2}
              label="Courts"
              cycling={cycling}
              onPause={pause}
            >
              {(matches) => (
                <div className="rr-kiosk-courts">
                  {matches.length ? (
                    matches.map((match) => (
                      <Court key={match.id} match={match} />
                    ))
                  ) : (
                    <p className="rr-kiosk-note">
                      Waiting for saved court assignments.
                    </p>
                  )}
                </div>
              )}
            </Pages>
            <Resting players={data.resting} />
          </section>
          <aside className="rr-kiosk-aside">
            <section className="rr-kiosk-section">
              <h2>
                <Trophy size={18} /> Leaderboard
              </h2>
              {data.standings.length ? (
                <Pages
                  key={eventId}
                  items={data.standings}
                  size={roomyDisplay ? 5 : 3}
                  label="Standings"
                  cycling={cycling}
                  onPause={pause}
                >
                  {(rows, offset) => <Ranking rows={rows} offset={offset} />}
                </Pages>
              ) : (
                <p className="rr-kiosk-note">
                  Standings will appear after the first scored match.
                </p>
              )}
              <p className="rr-kiosk-note">
                Active players · GP = games played · +/− = point difference
              </p>
            </section>
            <section className="rr-kiosk-section">
              <h2>
                Next up{data.nextRound ? ` · Round ${data.nextRound}` : ""}
              </h2>
              {data.nextRound ? (
                <>
                  <Pages
                    key={`${eventId}-${data.nextRound}`}
                    items={data.next}
                    size={roomyDisplay ? 2 : 1}
                    label="Next courts"
                    cycling={cycling}
                    onPause={pause}
                  >
                    {(matches) => (
                      <div className="rr-kiosk-next">
                        {matches.length ? (
                          matches.map((match) => (
                            <Court key={match.id} match={match} upcoming />
                          ))
                        ) : (
                          <p className="rr-kiosk-note">
                            No open courts in this saved round.
                          </p>
                        )}
                      </div>
                    )}
                  </Pages>
                  <Resting players={data.nextResting} />
                </>
              ) : (
                <p className="rr-kiosk-note">
                  No further rounds saved. The host will close the event when
                  play is finished.
                </p>
              )}
            </section>
          </aside>
        </main>
      )}
      {data && (
        <footer className="rr-kiosk-footer">
          <span>
            {complete
              ? "All recorded results are saved in event history."
              : ticker}
          </span>
          <span>
            {data.rounds.length} saved rounds ·{" "}
            {cycling ? "Pages cycle every 15s" : "Cycling paused"}
          </span>
        </footer>
      )}
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent
          style={{ background: colors.cardBg, color: colors.text }}
        >
          <AlertDialogTitle>Leave the courtside display?</AlertDialogTitle>
          <AlertDialogDescription style={{ color: colors.mutedText }}>
            Return to the event page. Managing scores and players still requires
            an authorized account.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in kiosk</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>
              Return to event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
