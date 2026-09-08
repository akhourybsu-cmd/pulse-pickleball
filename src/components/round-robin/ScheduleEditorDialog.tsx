import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  LockKeyhole,
  MoveHorizontal,
  Navigation,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModalActions, ResponsiveSettingsModal } from "./ResponsiveSettingsModal";

interface ScheduleMatch {
  id: string;
  round_no: number;
  court_no: number;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  a1_guest_id?: string | null;
  a2_guest_id?: string | null;
  b1_guest_id?: string | null;
  b2_guest_id?: string | null;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  match_id?: string | null;
  locked_at?: string | null;
  voided_at?: string | null;
  superseded_by_schedule_id?: string | null;
  abandoned?: boolean | null;
}

interface ScheduleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleMatch[];
  currentRound: number | null;
  eventStatus: "draft" | "live" | "completed" | "voided";
  eventFormat?: "open" | "mixed" | "male" | "female";
  numCourts: number;
  getPlayerName: (playerId: string | null) => string;
  /** Cross-rotate A1+A2 vs B1+B2 to A1+B1 vs A2+B2. */
  onRotatePartners: (matchId: string) => Promise<void>;
  /** Exchange Match 1 Team B with Match 2 Team A. */
  onSwapOpponents: (match1Id: string, match2Id: string) => Promise<void>;
  /** Move to an open court, or swap court assignments when occupied. */
  onMoveCourt: (matchId: string, newCourtNo: number) => Promise<void>;
}

type ActionMode = "rotate-partners" | "swap-opponents" | "move-court" | null;

const isCanonical = (match: ScheduleMatch) =>
  match.voided_at == null && match.superseded_by_schedule_id == null;

export function ScheduleEditorDialog({
  open,
  onOpenChange,
  schedule,
  currentRound,
  eventStatus,
  eventFormat = "open",
  numCourts,
  getPlayerName,
  onRotatePartners,
  onSwapOpponents,
  onMoveCourt,
}: ScheduleEditorDialogProps) {
  const rounds = useMemo(
    () => Array.from(new Set(schedule.map((match) => match.round_no))).sort((a, b) => a - b),
    [schedule],
  );
  const [mode, setMode] = useState<ActionMode>(null);
  const [selectedRound, setSelectedRound] = useState<number>(currentRound || rounds[0] || 1);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [selectedMatch2, setSelectedMatch2] = useState("");
  const [newCourtNo, setNewCourtNo] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedRound(currentRound || rounds[0] || 1);
    setMode(null);
    setSelectedMatch("");
    setSelectedMatch2("");
    setNewCourtNo(1);
  }, [currentRound, open, rounds]);

  const allRoundRows = schedule.filter((match) => match.round_no === selectedRound);
  const roundMatches = allRoundRows.filter((match) => !match.is_bye && isCanonical(match));
  const selectedMatchData = roundMatches.find((match) => match.id === selectedMatch);
  const selectedMatch2Data = roundMatches.find((match) => match.id === selectedMatch2);
  const destinationMatch = roundMatches.find(
    (match) => match.court_no === newCourtNo && match.id !== selectedMatch,
  );
  const availableCourts = Array.from({ length: Math.max(1, numCourts) }, (_, index) => index + 1);

  const lockReasonsForRound = (roundNo: number) => {
    const rows = schedule.filter((match) => match.round_no === roundNo);
    const reasons: string[] = [];

    if (eventStatus === "voided") reasons.push("This event is voided");
    if (eventStatus === "completed") reasons.push("This event is completed");
    if (eventStatus === "live" && roundNo <= (currentRound || 1)) {
      reasons.push(roundNo === (currentRound || 1) ? "The live round is locked" : "Completed live play is locked");
    }
    if (rows.some((match) => match.team1_score !== null || match.team2_score !== null)) {
      reasons.push("Saved scores must be preserved");
    }
    if (rows.some((match) => match.locked_at != null)) reasons.push("A match is host-locked");
    if (rows.some((match) => match.match_id != null)) reasons.push("A match is linked to match history");
    if (rows.some((match) => match.abandoned)) reasons.push("An abandoned match is preserved");
    if (rows.some((match) => match.voided_at != null)) reasons.push("Voided match history is preserved");
    if (rows.some((match) => match.superseded_by_schedule_id != null)) reasons.push("Prior schedule history is preserved");

    return Array.from(new Set(reasons));
  };

  const selectedRoundLockReasons = lockReasonsForRound(selectedRound);
  const isRoundLocked = selectedRoundLockReasons.length > 0;

  const resetAction = () => {
    setMode(null);
    setSelectedMatch("");
    setSelectedMatch2("");
    setNewCourtNo(1);
  };

  const close = () => {
    resetAction();
    onOpenChange(false);
  };

  const handleRotatePartners = async () => {
    if (!selectedMatch || isRoundLocked) return;
    setLoading(true);
    try {
      await onRotatePartners(selectedMatch);
      resetAction();
    } finally {
      setLoading(false);
    }
  };

  const handleSwapOpponents = async () => {
    if (!selectedMatch || !selectedMatch2 || selectedMatch === selectedMatch2 || isRoundLocked) return;
    setLoading(true);
    try {
      await onSwapOpponents(selectedMatch, selectedMatch2);
      resetAction();
    } finally {
      setLoading(false);
    }
  };

  const handleMoveCourt = async () => {
    if (!selectedMatchData || selectedMatchData.court_no === newCourtNo || isRoundLocked) return;
    setLoading(true);
    try {
      await onMoveCourt(selectedMatchData.id, newCourtNo);
      resetAction();
    } finally {
      setLoading(false);
    }
  };

  const chooseRound = (round: number) => {
    setSelectedRound(round);
    resetAction();
  };

  const chooseMatch = (match: ScheduleMatch) => {
    setSelectedMatch(match.id);
    if (mode === "move-court") setNewCourtNo(match.court_no);
  };

  const actionButton = mode === "rotate-partners" ? (
    <Button onClick={handleRotatePartners} disabled={!selectedMatch || isRoundLocked || loading} className="gap-1.5">
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
      {loading ? "Rotating…" : "Rotate partners"}
    </Button>
  ) : mode === "swap-opponents" ? (
    <Button
      onClick={handleSwapOpponents}
      disabled={!selectedMatch || !selectedMatch2 || selectedMatch === selectedMatch2 || isRoundLocked || loading}
      className="gap-1.5"
    >
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MoveHorizontal className="h-4 w-4" />}
      {loading ? "Swapping…" : "Swap opponents"}
    </Button>
  ) : mode === "move-court" ? (
    <Button
      onClick={handleMoveCourt}
      disabled={!selectedMatchData || selectedMatchData.court_no === newCourtNo || isRoundLocked || loading}
      className="gap-1.5"
    >
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
      {loading ? "Moving…" : destinationMatch ? "Swap courts" : "Move match"}
    </Button>
  ) : null;

  return (
    <ResponsiveSettingsModal
      open={open}
      onOpenChange={(next) => { if (!next) close(); }}
      title="Manual schedule editor"
      description="Make a precise one-round adjustment without regenerating the rest of the event."
      className="sm:max-w-[720px]"
      footer={
        <ModalActions>
          {mode && (
            <Button variant="outline" onClick={resetAction} disabled={loading} className="gap-1.5 sm:mr-auto">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {!mode && <Button variant="outline" onClick={close}>Close</Button>}
          {actionButton}
        </ModalActions>
      }
    >
      <div className="space-y-4 pb-1">
        <section>
          <div className="mb-2 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Choose round</h3>
            <span className="text-[11px] text-muted-foreground">Only future, unprotected rounds can change</span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rounds.map((round) => {
              const reasons = lockReasonsForRound(round);
              const active = round === selectedRound;
              return (
                <button
                  key={round}
                  type="button"
                  onClick={() => chooseRound(round)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50",
                  )}
                >
                  {reasons.length > 0 && <LockKeyhole className="h-3.5 w-3.5" />}
                  Round {round}
                </button>
              );
            })}
          </div>
        </section>

        {isRoundLocked ? (
          <Alert className="border-amber-500/30 bg-amber-500/[0.07]">
            <LockKeyhole className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs leading-relaxed">
              <strong className="font-semibold text-foreground">Round {selectedRound} is protected.</strong>{" "}
              {selectedRoundLockReasons.join(" · ")}. View its assignments below; editing is disabled so recorded play cannot be disconnected or rewritten.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Safe to adjust.</strong>{" "}
              Round {selectedRound} has no score, lock, match-history link, or abandoned result.
            </p>
          </div>
        )}

        {!mode && !isRoundLocked && (
          <div className="grid gap-2 sm:grid-cols-3">
            <EditorAction
              icon={ArrowLeftRight}
              title="Rotate partners"
              description={eventFormat === "mixed"
                ? "Create new partners while preserving mixed teams"
                : "Pair across the current teams to create two new partnerships"}
              onClick={() => setMode("rotate-partners")}
            />
            <EditorAction
              icon={MoveHorizontal}
              title="Swap opponents"
              description="Exchange Match 1 Team B with Match 2 Team A"
              onClick={() => setMode("swap-opponents")}
            />
            <EditorAction
              icon={Navigation}
              title="Move court"
              description="Move to an open court or swap occupied courts"
              onClick={() => setMode("move-court")}
            />
          </div>
        )}

        {mode === "rotate-partners" && !isRoundLocked && (
          <div className="space-y-3">
            <EditorSectionHeader
              title="Choose one match"
              description={eventFormat === "mixed"
                ? "This creates new partners while keeping one man and one woman on each team."
                : "The same four players stay on this court while the app creates two new partnerships."}
            />
            <MatchPicker
              matches={roundMatches}
              selectedId={selectedMatch}
              onSelect={chooseMatch}
              getPlayerName={getPlayerName}
            />

            {selectedMatchData && (
              <AdjustmentPreview title="After partner rotation">
                <PreviewCourt
                  court={selectedMatchData.court_no}
                  teamA={[
                    seatName(selectedMatchData, "a1", getPlayerName),
                    seatName(selectedMatchData, eventFormat === "mixed" ? "b2" : "b1", getPlayerName),
                  ]}
                  teamB={[
                    seatName(selectedMatchData, "a2", getPlayerName),
                    seatName(selectedMatchData, eventFormat === "mixed" ? "b1" : "b2", getPlayerName),
                  ]}
                />
              </AdjustmentPreview>
            )}
          </div>
        )}

        {mode === "swap-opponents" && !isRoundLocked && (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/[0.055] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              Match 1 keeps Team A and receives Match 2 Team A. Match 2 receives Match 1 Team B and keeps Team B.
            </div>

            <div className="space-y-2">
              <EditorSectionHeader title="1 · Choose Match 1" description="Its Team B will move to Match 2." />
              <MatchPicker
                matches={roundMatches}
                selectedId={selectedMatch}
                onSelect={(match) => {
                  setSelectedMatch(match.id);
                  if (match.id === selectedMatch2) setSelectedMatch2("");
                }}
                getPlayerName={getPlayerName}
              />
            </div>

            {selectedMatch && (
              <div className="space-y-2">
                <EditorSectionHeader title="2 · Choose Match 2" description="Its Team A will move to Match 1." />
                <MatchPicker
                  matches={roundMatches.filter((match) => match.id !== selectedMatch)}
                  selectedId={selectedMatch2}
                  onSelect={(match) => setSelectedMatch2(match.id)}
                  getPlayerName={getPlayerName}
                />
              </div>
            )}

            {selectedMatchData && selectedMatch2Data && (
              <AdjustmentPreview title="After opponent swap">
                <div className="grid gap-2 sm:grid-cols-2">
                  <PreviewCourt
                    court={selectedMatchData.court_no}
                    teamA={teamA(selectedMatchData, getPlayerName)}
                    teamB={teamA(selectedMatch2Data, getPlayerName)}
                  />
                  <PreviewCourt
                    court={selectedMatch2Data.court_no}
                    teamA={teamB(selectedMatchData, getPlayerName)}
                    teamB={teamB(selectedMatch2Data, getPlayerName)}
                  />
                </div>
              </AdjustmentPreview>
            )}
          </div>
        )}

        {mode === "move-court" && !isRoundLocked && (
          <div className="space-y-4">
            <div className="space-y-2">
              <EditorSectionHeader title="Choose a match" description="Its teams stay together." />
              <MatchPicker
                matches={roundMatches}
                selectedId={selectedMatch}
                onSelect={chooseMatch}
                getPlayerName={getPlayerName}
              />
            </div>

            {selectedMatchData && (
              <div className="space-y-2">
                <EditorSectionHeader title="Choose destination" description={`Court assignments available: 1–${Math.max(1, numCourts)}.`} />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {availableCourts.map((court) => {
                    const occupied = roundMatches.some((match) => match.id !== selectedMatch && match.court_no === court);
                    const current = selectedMatchData.court_no === court;
                    return (
                      <button
                        key={court}
                        type="button"
                        onClick={() => setNewCourtNo(court)}
                        disabled={current}
                        aria-pressed={newCourtNo === court}
                        className={cn(
                          "min-h-12 rounded-xl border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-default",
                          newCourtNo === court && !current
                            ? "border-primary bg-primary text-primary-foreground"
                            : current
                              ? "border-border bg-muted/50 text-muted-foreground"
                              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <span className="block text-sm font-bold">Court {court}</span>
                        <span className="mt-0.5 block text-[9.5px] font-medium uppercase tracking-wide opacity-75">
                          {current ? "Current" : occupied ? "Swap" : "Open"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedMatchData && selectedMatchData.court_no !== newCourtNo && (
              <AdjustmentPreview title={destinationMatch ? "Court assignments will swap" : "Match will move"}>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="font-semibold text-foreground">Court {selectedMatchData.court_no}</strong>{" "}
                  moves to <strong className="font-semibold text-foreground">Court {newCourtNo}</strong>.
                  {destinationMatch
                    ? ` The match currently on Court ${newCourtNo} moves to Court ${selectedMatchData.court_no}, so both courts remain uniquely assigned.`
                    : " That destination is open, so no other match changes."}
                </p>
              </AdjustmentPreview>
            )}
          </div>
        )}

        {!mode && (
          <section className="border-t border-border/60 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Round {selectedRound} assignments</h3>
              <Badge variant="secondary">{roundMatches.length} {roundMatches.length === 1 ? "match" : "matches"}</Badge>
            </div>
            {roundMatches.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {roundMatches.map((match) => (
                  <MatchSummary key={match.id} match={match} getPlayerName={getPlayerName} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No active matches in this round.
              </div>
            )}
          </section>
        )}
      </div>
    </ResponsiveSettingsModal>
  );
}

type Seat = "a1" | "a2" | "b1" | "b2";

function seatName(
  match: ScheduleMatch,
  seat: Seat,
  getPlayerName: (playerId: string | null) => string,
) {
  return getPlayerName(match[`${seat}_player_id`] ?? match[`${seat}_guest_id`] ?? null);
}

function teamA(match: ScheduleMatch, getPlayerName: (playerId: string | null) => string) {
  return [seatName(match, "a1", getPlayerName), seatName(match, "a2", getPlayerName)] as [string, string];
}

function teamB(match: ScheduleMatch, getPlayerName: (playerId: string | null) => string) {
  return [seatName(match, "b1", getPlayerName), seatName(match, "b2", getPlayerName)] as [string, string];
}

function EditorAction({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[104px] items-start gap-3 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-[0_10px_30px_-24px_hsl(var(--foreground)/0.5)] transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_36px_-26px_hsl(var(--primary)/0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex-col"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function EditorSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
    </div>
  );
}

function MatchPicker({
  matches,
  selectedId,
  onSelect,
  getPlayerName,
}: {
  matches: ScheduleMatch[];
  selectedId: string;
  onSelect: (match: ScheduleMatch) => void;
  getPlayerName: (playerId: string | null) => string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {matches.map((match) => {
        const selected = match.id === selectedId;
        return (
          <button
            key={match.id}
            type="button"
            onClick={() => onSelect(match)}
            aria-pressed={selected}
            aria-label={`Court ${match.court_no}: ${teamA(match, getPlayerName).join(" and ")} versus ${teamB(match, getPlayerName).join(" and ")}`}
            className={cn(
              "relative min-w-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              selected
                ? "border-primary bg-primary/[0.07] shadow-sm"
                : "border-border bg-card hover:border-primary/35 hover:bg-muted/30",
            )}
          >
            {selected && (
              <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
            <MatchSummary match={match} getPlayerName={getPlayerName} compact />
          </button>
        );
      })}
    </div>
  );
}

function MatchSummary({
  match,
  getPlayerName,
  compact = false,
}: {
  match: ScheduleMatch;
  getPlayerName: (playerId: string | null) => string;
  compact?: boolean;
}) {
  return (
    <div className={cn(!compact && "rounded-xl border border-border/70 bg-card p-3")}>
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="secondary" className="font-semibold">Court {match.court_no}</Badge>
        {(match.team1_score !== null || match.team2_score !== null) && <Badge>Scored</Badge>}
      </div>
      <div className="space-y-1.5 text-xs leading-snug">
        <TeamLine label="A" names={teamA(match, getPlayerName)} />
        <TeamLine label="B" names={teamB(match, getPlayerName)} />
      </div>
    </div>
  );
}

function TeamLine({ label, names }: { label: string; names: readonly [string, string] }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-3 shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium text-foreground" title={`${names[0]} & ${names[1]}`}>
        {names[0]} <span className="font-normal text-muted-foreground">&</span> {names[1]}
      </span>
    </div>
  );
}

function AdjustmentPreview({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card p-3.5">
      <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{title}</div>
      {children}
    </section>
  );
}

function PreviewCourt({
  court,
  teamA: firstTeam,
  teamB: secondTeam,
}: {
  court: number;
  teamA: readonly [string, string];
  teamB: readonly [string, string];
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/75 p-3">
      <div className="mb-2 text-xs font-bold text-foreground">Court {court}</div>
      <div className="space-y-1.5 text-xs">
        <TeamLine label="A" names={firstTeam} />
        <div className="pl-5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">versus</div>
        <TeamLine label="B" names={secondTeam} />
      </div>
    </div>
  );
}
