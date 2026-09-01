import { useEffect, useMemo, useState } from "react";
import { Trophy, Check, Rows3, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Bracket rendering.
 *
 * Two things were wrong with the previous version:
 *
 *  1. It flattened every match into a single row of rounds keyed on
 *     `round_number`. A double-elimination draw has TWO ladders that both start
 *     at round 1, so winners-round-1 and losers-round-1 were stacked into the
 *     same column and the draw was unreadable. It now groups on the `bracket`
 *     discriminator and renders Winners / Losers / Grand Final as separate
 *     ladders, each with its own round numbering.
 *
 *  2. It was desktop-only. A 16-team bracket is ~5 columns of 280px cards, so
 *     on a phone you got a horizontal scroll with two thirds of a match visible
 *     at a time — the single loudest complaint about every bracket app on the
 *     market. There are now two views: a **Rounds** view (default on phones)
 *     that shows one round at a time as a full-width list, and a **Map** view
 *     (default on desktop) that draws the classic tree with connectors.
 *
 * `team1_id` / `team2_id` are nullable: elimination draws are generated in full
 * up front, so downstream slots legitimately hold no team until a result feeds
 * them.
 */

interface Team {
  id?: string;
  team_name: string;
  seed_number?: number | null;
}

export interface BracketMatch {
  id: string;
  round_number: number;
  match_number: number;
  /** winners | losers | grand_final. NULL on rows generated before the discriminator. */
  bracket?: string | null;
  team1_id: string | null;
  team2_id: string | null;
  team1_score?: number | null;
  team2_score?: number | null;
  status: string;
  team1?: Team | null;
  team2?: Team | null;
}

type SectionKey = "winners" | "losers" | "grand_final";

interface BracketViewProps {
  matches: BracketMatch[];
  format: "single_elimination" | "double_elimination";
  onMatchClick: (match: BracketMatch) => void;
}

const SECTION_ORDER: SectionKey[] = ["winners", "losers", "grand_final"];

interface RoundGroup {
  section: SectionKey;
  round: number;
  /** Full label, e.g. "Winners Semifinals". */
  label: string;
  /** Compact label for the round strip, e.g. "WSF". */
  short: string;
  matches: BracketMatch[];
}

interface Section {
  key: SectionKey;
  title: string;
  rounds: RoundGroup[];
}

function winnerIdOf(match: BracketMatch): string | null {
  if (match.status !== "completed") return null;
  const a = match.team1_score ?? 0;
  const b = match.team2_score ?? 0;
  if (a === b) return null;
  return a > b ? match.team1_id : match.team2_id;
}

/**
 * Round names are relative to the END of a ladder, not to a global round count.
 * Mixing the losers bracket into that count is what made the old labels wrong.
 */
function labelFor(
  section: SectionKey,
  round: number,
  roundsInSection: number,
  indexInSection: number,
  isDouble: boolean,
): { label: string; short: string } {
  if (section === "grand_final") {
    return indexInSection === 0
      ? { label: "Grand Final", short: "GF" }
      : { label: "Bracket Reset", short: "RESET" };
  }

  const fromEnd = roundsInSection - 1 - indexInSection;

  if (section === "losers") {
    if (fromEnd === 0) return { label: "Losers Final", short: "LF" };
    if (fromEnd === 1) return { label: "Losers Semifinals", short: "LSF" };
    return { label: `Losers Round ${round}`, short: `LR${round}` };
  }

  if (isDouble) {
    if (fromEnd === 0) return { label: "Winners Final", short: "WF" };
    if (fromEnd === 1) return { label: "Winners Semifinals", short: "WSF" };
    if (fromEnd === 2) return { label: "Winners Quarterfinals", short: "WQF" };
    return { label: `Winners Round ${round}`, short: `WR${round}` };
  }

  if (fromEnd === 0) return { label: "Final", short: "F" };
  if (fromEnd === 1) return { label: "Semifinals", short: "SF" };
  if (fromEnd === 2) return { label: "Quarterfinals", short: "QF" };
  if (fromEnd === 3) return { label: "Round of 16", short: "R16" };
  return { label: `Round ${round}`, short: `R${round}` };
}

export const BracketView = ({ matches, format, onMatchClick }: BracketViewProps) => {
  const isDouble = format === "double_elimination";
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<"rounds" | "map">("rounds");
  const [activeRoundKey, setActiveRoundKey] = useState<string | null>(null);

  // Phones get the readable one-round-at-a-time view; anything wider can hold
  // the whole tree, which is the view organizers actually want on a laptop.
  useEffect(() => {
    setMode(isMobile ? "rounds" : "map");
  }, [isMobile]);

  const sections = useMemo<Section[]>(() => {
    const byBracket = new Map<SectionKey, BracketMatch[]>();

    for (const m of matches) {
      // Round robin never sets `bracket`, and single-elim draws generated before
      // the discriminator existed carry NULL — both belong on the main ladder.
      const raw = (m.bracket ?? "winners") as SectionKey;
      const key: SectionKey = SECTION_ORDER.includes(raw) ? raw : "winners";
      const list = byBracket.get(key);
      if (list) list.push(m);
      else byBracket.set(key, [m]);
    }

    return SECTION_ORDER.filter((key) => byBracket.has(key)).map((key) => {
      const list = byBracket.get(key)!;
      const roundNumbers = [...new Set(list.map((m) => m.round_number))].sort((a, b) => a - b);

      const rounds: RoundGroup[] = roundNumbers.map((round, i) => {
        const { label, short } = labelFor(key, round, roundNumbers.length, i, isDouble);
        return {
          section: key,
          round,
          label,
          short,
          matches: list
            .filter((m) => m.round_number === round)
            .sort((a, b) => a.match_number - b.match_number),
        };
      });

      const title =
        key === "winners"
          ? isDouble
            ? "Winners Bracket"
            : "Bracket"
          : key === "losers"
            ? "Losers Bracket"
            : "Grand Final";

      return { key, title, rounds };
    });
  }, [matches, isDouble]);

  const allRounds = useMemo(() => sections.flatMap((s) => s.rounds), [sections]);

  // Land on the round that's actually being played rather than round 1, so an
  // organizer opening the tab mid-event sees the live matches first.
  useEffect(() => {
    if (allRounds.length === 0) {
      setActiveRoundKey(null);
      return;
    }
    setActiveRoundKey((current) => {
      if (current && allRounds.some((r) => roundKey(r) === current)) return current;
      const live =
        allRounds.find((r) => r.matches.some((m) => m.status === "in_progress")) ??
        allRounds.find((r) => r.matches.some((m) => m.status !== "completed")) ??
        allRounds[allRounds.length - 1];
      return roundKey(live);
    });
  }, [allRounds]);

  const completed = matches.filter((m) => m.status === "completed").length;

  // The champion is whoever won the last match of the last ladder: the final in
  // a single-elim draw, or the grand final (or its reset) in a double.
  const champion = useMemo(() => {
    const lastSection = sections[sections.length - 1];
    if (!lastSection) return null;
    const lastRound = lastSection.rounds[lastSection.rounds.length - 1];
    if (!lastRound || lastRound.matches.length !== 1) return null;
    const final = lastRound.matches[0];
    const winnerId = winnerIdOf(final);
    if (!winnerId) return null;
    return winnerId === final.team1_id ? final.team1 : final.team2;
  }, [sections]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-semibold text-foreground">No bracket yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seed the teams, then generate the bracket to build the draw.
        </p>
      </div>
    );
  }

  const activeRound = allRounds.find((r) => roundKey(r) === activeRoundKey) ?? allRounds[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Trophy className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold leading-tight">
              {isDouble ? "Double Elimination" : "Single Elimination"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {completed} of {matches.length} matches complete
            </p>
          </div>
        </div>

        <div className="ml-auto inline-flex rounded-lg border border-border bg-card p-0.5">
          <ModeButton active={mode === "rounds"} onClick={() => setMode("rounds")} icon={Rows3}>
            Rounds
          </ModeButton>
          <ModeButton active={mode === "map"} onClick={() => setMode("map")} icon={GitBranch}>
            Map
          </ModeButton>
        </div>
      </div>

      {champion && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <Trophy className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Champion
          </span>
          <span className="truncate text-sm font-semibold">{champion.team_name}</span>
        </div>
      )}

      {mode === "rounds" ? (
        <div className="space-y-3">
          {/* One horizontal strip of small chips is far easier to thumb through
              than a horizontally scrolling wall of match cards. */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-1.5">
              {allRounds.map((r) => {
                const key = roundKey(r);
                const done = r.matches.every((m) => m.status === "completed");
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveRoundKey(key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      key === activeRoundKey
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r.short}
                    {done && <Check className="h-3 w-3 opacity-70" />}
                  </button>
                );
              })}
            </div>
          </div>

          {activeRound && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">{activeRound.label}</h4>
                <span className="text-xs text-muted-foreground">
                  {activeRound.matches.filter((m) => m.status === "completed").length}/
                  {activeRound.matches.length} complete
                </span>
              </div>
              <div className="space-y-2.5">
                {activeRound.matches.map((match) => (
                  <MatchCard key={match.id} match={match} onClick={onMatchClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <BracketLadder
              key={section.key}
              section={section}
              showTitle={sections.length > 1}
              onMatchClick={onMatchClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function roundKey(r: RoundGroup) {
  return `${r.section}-${r.round}`;
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Rows3;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/**
 * The classic tree, one ladder at a time.
 *
 * Vertical geometry falls out of flexbox rather than being computed: every
 * match sits in a `flex-1` cell, so a round with half as many matches has cells
 * twice as tall, and each cell's centre lands exactly midway between its two
 * feeders. That makes the connector elbows exact — the vertical spine drawn
 * from a cell's centre is precisely one cell tall.
 */
function BracketLadder({
  section,
  showTitle,
  onMatchClick,
}: {
  section: Section;
  showTitle: boolean;
  onMatchClick: (m: BracketMatch) => void;
}) {
  const tallest = Math.max(...section.rounds.map((r) => r.matches.length));

  return (
    <div className="space-y-3">
      {showTitle && (
        <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {section.title}
        </h4>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-10" style={{ minHeight: tallest * 96 }}>
          {section.rounds.map((round, roundIndex) => {
            const next = section.rounds[roundIndex + 1];
            // Only a halving transition has paired feeders to join. Losers-bracket
            // "major" rounds keep the same field size, so they get plain stubs.
            const halves = !!next && next.matches.length * 2 === round.matches.length;

            return (
              <div key={roundKey(round)} className="flex w-[220px] shrink-0 flex-col">
                <div className="mb-2 text-center">
                  <Badge variant="outline" className="text-[11px] font-semibold">
                    {round.label}
                  </Badge>
                </div>

                <div className="flex flex-1 flex-col">
                  {round.matches.map((match, i) => (
                    <div key={match.id} className="relative flex flex-1 items-center">
                      {roundIndex > 0 && (
                        <span
                          aria-hidden
                          className="absolute right-full top-1/2 h-px w-5 bg-border"
                        />
                      )}
                      {next && (
                        <span
                          aria-hidden
                          className="absolute left-full top-1/2 h-px w-5 bg-border"
                        />
                      )}
                      {halves && i % 2 === 0 && (
                        <span
                          aria-hidden
                          className="absolute top-1/2 h-full w-px bg-border"
                          style={{ left: "calc(100% + 1.25rem)" }}
                        />
                      )}
                      <div className="w-full">
                        <MatchCard match={match} onClick={onMatchClick} compact />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  onClick,
  compact = false,
}: {
  match: BracketMatch;
  onClick: (m: BracketMatch) => void;
  compact?: boolean;
}) {
  const winnerId = winnerIdOf(match);
  const live = match.status === "in_progress";
  const decided = match.status === "completed";

  return (
    <button
      type="button"
      onClick={() => onClick(match)}
      className={cn(
        "w-full rounded-xl border bg-card text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        live ? "border-primary/50" : "border-border",
        compact ? "p-2" : "p-3",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Match {match.match_number}
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Live
          </span>
        ) : decided ? (
          <Check className="h-3.5 w-3.5 text-muted-foreground" />
        ) : null}
      </div>

      <TeamRow
        team={match.team1}
        score={match.team1_score}
        isWinner={!!winnerId && winnerId === match.team1_id}
        dimmed={decided && !!winnerId && winnerId !== match.team1_id}
        compact={compact}
      />
      <TeamRow
        team={match.team2}
        score={match.team2_score}
        isWinner={!!winnerId && winnerId === match.team2_id}
        dimmed={decided && !!winnerId && winnerId !== match.team2_id}
        compact={compact}
      />
    </button>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  dimmed,
  compact,
}: {
  team?: Team | null;
  score?: number | null;
  isWinner: boolean;
  dimmed: boolean;
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2",
        compact ? "py-1" : "py-1.5",
        isWinner && "bg-primary/10",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {typeof team?.seed_number === "number" && (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
            {team.seed_number}
          </span>
        )}
        <span
          className={cn(
            "truncate text-sm",
            !team && "italic text-muted-foreground",
            isWinner && "font-semibold text-foreground",
            dimmed && "text-muted-foreground",
          )}
        >
          {team?.team_name ?? "TBD"}
        </span>
      </span>
      {score !== null && score !== undefined && (
        <span
          className={cn(
            "shrink-0 font-mono text-sm tabular-nums",
            isWinner ? "font-bold text-foreground" : "text-muted-foreground",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}
