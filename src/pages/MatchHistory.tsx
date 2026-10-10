import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  Flag,
  History,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";
import { useMatchHistory } from "@/hooks/useMatchHistory";
import { confirmMatchScore as saveMatchConfirmation } from "@/lib/confirmMatchScore";
import { getErrorMessage } from "@/lib/getErrorMessage";
import {
  groupMatchHistory,
  verificationStatus,
  type HistoryMatch,
} from "@/lib/matchHistory";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PlayerSegmentedControl } from "@/components/layout/PlayerSegmentedControl";
import { SocialHero } from "@/components/social/_shared";
import { PremiumMatchCard } from "@/components/matches/PremiumMatchCard";
import { RoundRobinMatchGroup } from "@/components/matches/RoundRobinMatchGroup";
import { cn } from "@/lib/utils";
import { linkedHistoryMatch } from '@/lib/navigation/matchLink';

const issues = [
  { value: "contest_result", label: "Incorrect score" },
  { value: "wrong_court", label: "Incorrect location" },
  { value: "wrong_opponent", label: "Incorrect players" },
  { value: "didnt_play", label: "I did not play this match" },
] as const;
const issueSchema = z.object({
  matchId: z.string().uuid(),
  issueType: z.enum([
    "contest_result",
    "wrong_court",
    "wrong_opponent",
    "didnt_play",
  ]),
  details: z
    .string()
    .trim()
    .max(500, "Keep details to 500 characters or fewer."),
});
const emptyMatches: HistoryMatch[] = [];

export default function MatchHistory() {
  const auth = useAuthState();
  const viewerId = auth.user?.id || null;
  const [params, setParams] = useSearchParams();
  const subjectId = params.get("player") || viewerId;
  const ownHistory = !!viewerId && subjectId === viewerId;
  const navigate = useNavigate();
  const history = useMatchHistory(subjectId, viewerId);
  const matches = history.data?.matches || emptyMatches;
  const pending = ownHistory
    ? history.data?.pendingMatches || emptyMatches
    : emptyMatches;
  const linkedId = params.get('match');
  const linked = linkedHistoryMatch(linkedId, matches, pending);
  const showAllMatches = () => {
    const next = new URLSearchParams(params);
    next.delete('match');
    setParams(next, { replace: true });
  };
  const playerName = history.data?.playerName || "Player";
  const playerAvatarUrl = history.data?.playerAvatarUrl;
  const tab = params.get("tab");
  const activeTab =
    ownHistory && (tab === "pending" || tab === "verified") ? tab : "all";
  const [rankedOnly, setRankedOnly] = useState(false);
  const [shown, setShown] = useState(15);
  const [verify, setVerify] = useState<{ id: string; pending: boolean } | null>(
    null
  );
  const [reportId, setReportId] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<string>("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const identity = `${viewerId}:${subjectId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(() => {
    if (!auth.loading && !viewerId) navigate("/auth", { replace: true });
  }, [auth.loading, viewerId, navigate]);
  useEffect(() => {
    setVerify(null);
    setReportId(null);
    setIssueType("");
    setDetails("");
    setRankedOnly(false);
    setShown(15);
  }, [identity]);
  useEffect(() => {
    setShown(15);
  }, [activeTab, rankedOnly]);
  const items = useMemo(
    () => groupMatchHistory(matches, rankedOnly),
    [matches, rankedOnly]
  );
  const ranked = matches.filter((m) => m.is_ranked);
  const wins = matches.filter((m) => m.won).length;
  const rankedWins = ranked.filter((m) => m.won).length;
  const needsConfirmation = pending.filter(
    (m) => !m.verified_by.includes(viewerId || "")
  );
  const waiting = pending.filter((m) => m.verified_by.includes(viewerId || ""));
  const verificationMatch = verify
    ? (verify.pending ? pending : matches).find(
        (match) => match.match_id === verify.id
      )
    : undefined;
  const canAct = (match: HistoryMatch | undefined) =>
    ownHistory &&
    !history.isError &&
    !!viewerId &&
    !!match?.registered_player_ids.includes(viewerId);
  const openReport = (id: string) => {
    setIssueType("");
    setDetails("");
    setReportId(id);
  };
  const changeTab = (next: string) => {
    const updated = new URLSearchParams(params);
    if (next === "all") updated.delete("tab");
    else updated.set("tab", next);
    setParams(updated, { replace: true });
  };

  async function runAction(action: () => Promise<void>) {
    if (actionLock.current || !ownHistory || !viewerId) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      if (currentIdentity.current === identity)
        toast.error(
          getErrorMessage(
            error,
            "Could not save your change. Please try again."
          )
        );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function confirmScore() {
    if (!verify) return;
    const match = (verify.pending ? pending : matches).find(
      (m) => m.match_id === verify.id
    );
    if (!canAct(match)) {
      toast.info("This match has changed. Refreshing your history.");
      setVerify(null);
      void history.refetch();
      return;
    }
    await runAction(async () => {
      if (verify.pending && !match!.approval_player_ids.includes(viewerId!)) {
        throw new Error(
          "This score is not awaiting your confirmation. Refresh your matches."
        );
      }
      await saveMatchConfirmation(verify.id, viewerId!, verify.pending);
      if (currentIdentity.current !== identity) return;
      toast.success(
        "Score confirmed. Your match history will update when the required players confirm."
      );
      setVerify(null);
      await history.refetch();
    });
  }
  async function reportIssue() {
    const match = [...matches, ...pending].find((m) => m.match_id === reportId);
    if (!canAct(match)) return;
    const validated = issueSchema.safeParse({
      matchId: reportId,
      issueType,
      details,
    });
    if (!validated.success) {
      toast.error(validated.error.errors[0].message);
      return;
    }
    await runAction(async () => {
      const { error } = await supabase.from("match_issues").insert({
        match_id: validated.data.matchId,
        reported_by: viewerId!,
        issue_type: validated.data.issueType,
        details: validated.data.details || null,
      });
      if (error) throw error;
      if (currentIdentity.current !== identity) return;
      toast.success("Report submitted for review.");
      setReportId(null);
    });
  }
  async function remindPlayers(match: HistoryMatch) {
    if (!canAct(match)) return;
    await runAction(async () => {
      const { data, error } = await supabase.rpc("nudge_match_opponents", {
        p_match_id: match.match_id,
      });
      if (error) throw error;
      if (currentIdentity.current !== identity) return;
      const count = Array.isArray(data) ? data.length : 0;
      if (count)
        toast.success(`Reminded ${count} player${count === 1 ? "" : "s"}.`);
      else toast.info("Already reminded recently. Try again later.");
    });
  }
  const renderMatch = (match: HistoryMatch, isPending = false) => {
    const status = verificationStatus(match, viewerId, isPending);
    return (
      <PremiumMatchCard
        key={match.match_id}
        matchId={match.match_id}
        matchDate={match.match_date}
        team1Score={match.team1_score}
        team2Score={match.team2_score}
        myTeam={match.my_team}
        won={match.won}
        playerId={subjectId}
        playerName={playerName}
        playerAvatarUrl={playerAvatarUrl}
        partnerName={match.partner_name}
        partnerId={match.partner_id}
        partnerAvatarUrl={match.partner_avatar_url}
        opponent1Name={match.opponent1_name}
        opponent1Id={match.opponent1_id}
        opponent1AvatarUrl={match.opponent1_avatar_url}
        opponent2Name={match.opponent2_name}
        opponent2Id={match.opponent2_id}
        opponent2AvatarUrl={match.opponent2_avatar_url}
        ratingChange={match.rating_change}
        courtName={match.court_name}
        source={match.source}
        roundNo={match.round_no}
        courtNo={match.court_no}
        isRanked={match.is_ranked}
        {...status}
        showVerifyActions={canAct(match)}
        onVerify={() => setVerify({ id: match.match_id, pending: false })}
        onReport={() => openReport(match.match_id)}
        pending={isPending}
        pendingConfirmedByMe={status.isCurrentUserVerified}
        onConfirm={
          canAct(match) && match.approval_player_ids.includes(viewerId!)
            ? () => setVerify({ id: match.match_id, pending: true })
            : undefined
        }
        busy={busy}
        perspective={ownHistory ? "self" : "other"}
      />
    );
  };

  if (auth.loading || history.isPending)
    return (
      <div
        className="mx-auto max-w-6xl space-y-5 px-4 py-6"
        role="status"
        aria-label="Loading matches"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-2xl" />
        ))}
        <span className="sr-only">Loading matches</span>
      </div>
    );
  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      <SocialHero
        className="[&>div:last-child]:max-w-6xl [&>div:last-child]:lg:px-6"
        eyebrow="Performance"
        title={ownHistory ? "Matches" : `${playerName}’s matches`}
        action={
          ownHistory ? (
            <Button
              onClick={() => navigate("/player/matches/new")}
              size="sm"
              className="h-11 rounded-xl px-3"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Record
            </Button>
          ) : undefined
        }
      >
        <p className="mt-2 text-sm text-muted-foreground">
          {ownHistory
            ? "Your results, round robins and PULSE progress."
            : "Match results and PULSE progress."}
        </p>
        {!ownHistory && subjectId && (
          <Link
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
            to={`/player/profile/${encodeURIComponent(subjectId)}`}
          >
            Back to profile
          </Link>
        )}
      </SocialHero>
      <div className="mx-auto max-w-6xl space-y-5 px-4 pb-10 pt-5 sm:px-6">
        {history.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">Could not load matches</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {history.data
                  ? "Showing the last loaded results. Refresh before confirming a score."
                  : "Please try again. Your match history has not been changed."}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={history.isFetching}
              onClick={() => void history.refetch()}
            >
              <RefreshCw
                className={cn(
                  "mr-2 h-4 w-4",
                  history.isFetching && "animate-spin"
                )}
              />
              Try again
            </Button>
          </div>
        )}
        {history.data && linkedId && (
          <section aria-label="Selected match" className="mx-auto max-w-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Selected match</h2>
              <Button variant="outline" className="min-h-11 rounded-xl" onClick={showAllMatches}>View all matches</Button>
            </div>
            {linked ? <>
              {renderMatch(linked.match, linked.pending)}
              {linked.match.rr_event_id && <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4" to={`/round-robin/${encodeURIComponent(linked.match.rr_event_id)}`}>View round robin</Link>}
            </> : <div role="status" className="rounded-2xl border border-border/60 bg-card p-5">
              <p className="font-semibold">This match isn’t available</p>
              <p className="mt-2 text-sm text-muted-foreground">It may have been removed or belong to another account. You can still view your available matches.</p>
            </div>}
          </section>
        )}
        {history.data && !linkedId && (
          <>
            <div className="grid grid-cols-3 divide-x divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card px-1 py-4 sm:py-5">
              <div className="px-2 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {matches.length}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                  Completed
                </p>
              </div>
              <div className="px-2 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {wins}
                  <span className="font-normal text-muted-foreground">–</span>
                  {matches.length - wins}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                  Wins – losses
                </p>
              </div>
              <div className="px-2 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {matches.length
                    ? Math.round((wins / matches.length) * 100)
                    : 0}
                  <span className="text-base text-muted-foreground">%</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                  Win rate
                </p>
              </div>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 space-y-5">
                {ownHistory && (
                  <PlayerSegmentedControl
                    value={activeTab}
                    onValueChange={changeTab}
                    options={[
                      { value: "all", label: "All" },
                      {
                        value: "pending",
                        label: "Pending",
                        count: pending.length,
                        accentCount: needsConfirmation.length > 0,
                      },
                      {
                        value: "verified",
                        label: "Results",
                        count: matches.length,
                      },
                    ]}
                    ariaLabel="Match views"
                    layoutId="matches-seg-active"
                  />
                )}
                {activeTab !== "verified" && ownHistory && (
                  <>
                    {needsConfirmation.length > 0 && (
                      <section
                        aria-label="Needs your confirmation"
                        className="space-y-3"
                      >
                        <h2 className="flex items-center gap-2 text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          Needs your confirmation{" "}
                          <span className="text-muted-foreground">
                            ({needsConfirmation.length})
                          </span>
                        </h2>
                        {needsConfirmation.map((match) =>
                          renderMatch(match, true)
                        )}
                      </section>
                    )}
                    {waiting.length > 0 && (
                      <section
                        aria-label="Waiting on players"
                        className="space-y-3"
                      >
                        <h2 className="flex items-center gap-2 text-sm font-semibold">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Waiting on players{" "}
                          <span className="text-muted-foreground">
                            ({waiting.length})
                          </span>
                        </h2>
                        {waiting.map((match) => (
                          <div key={match.match_id} className="space-y-1">
                            {renderMatch(match, true)}
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                disabled={busy}
                                className="min-h-11 text-xs"
                                onClick={() => void remindPlayers(match)}
                              >
                                Remind players
                              </Button>
                            </div>
                          </div>
                        ))}
                      </section>
                    )}
                    {activeTab === "pending" && pending.length === 0 && (
                      <EmptyState
                        title="All caught up"
                        description="No scores are waiting for confirmation."
                      />
                    )}
                  </>
                )}
                {activeTab !== "pending" && (
                  <section aria-label="Completed matches" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold">
                        Completed matches
                      </h2>
                      {ranked.length < matches.length && (
                        <div
                          className="inline-flex rounded-xl border border-border/60 bg-card p-1"
                          role="group"
                          aria-label="Rating filter"
                        >
                          {[
                            { value: false, label: "All games" },
                            { value: true, label: "Ranked" },
                          ].map((option) => (
                            <button
                              type="button"
                              key={option.label}
                              aria-pressed={rankedOnly === option.value}
                              onClick={() => setRankedOnly(option.value)}
                              className={cn(
                                "min-h-10 rounded-lg px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                rankedOnly === option.value
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <EmptyState
                        title={
                          rankedOnly
                            ? "No ranked matches yet"
                            : "No completed matches yet"
                        }
                        description={
                          rankedOnly
                            ? "Ranked games will appear here once confirmed."
                            : ownHistory
                            ? "Record a game to start building your match history."
                            : "Completed results will appear here."
                        }
                        action={
                          ownHistory && !rankedOnly ? (
                            <Button
                              onClick={() => navigate("/player/matches/new")}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Record a match
                            </Button>
                          ) : undefined
                        }
                      />
                    ) : (
                      items
                        .slice(0, shown)
                        .map((item) =>
                          item.kind === "single" ? (
                            renderMatch(item.match)
                          ) : (
                            <RoundRobinMatchGroup
                              key={item.group.eventId}
                              group={item.group}
                              playerId={subjectId}
                              playerName={playerName}
                              playerAvatarUrl={playerAvatarUrl}
                              showVerifyActions={ownHistory && !history.isError}
                              perspective={ownHistory ? "self" : "other"}
                              getVerificationStatus={(match) =>
                                verificationStatus(match, viewerId)
                              }
                              onVerify={(id) =>
                                setVerify({ id, pending: false })
                              }
                              onReport={openReport}
                              busy={busy}
                            />
                          )
                        )
                    )}
                    {items.length > shown && (
                      <Button
                        variant="outline"
                        className="min-h-11 w-full rounded-xl"
                        onClick={() => setShown((count) => count + 15)}
                      >
                        Show more history ({items.length - shown} remaining)
                      </Button>
                    )}
                  </section>
                )}
              </div>
              <aside className="space-y-4 lg:sticky lg:top-24">
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    PULSE ranked record
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {rankedWins}–{ranked.length - rankedWins}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Only ranked, completed matches affect the PULSE rating.
                    Unranked games stay in your history.
                  </p>
                  {ownHistory && (
                    <Link
                      to="/player/pulse"
                      className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
                    >
                      View your PULSE progress
                    </Link>
                  )}
                </div>
                {ownHistory && (
                  <Button
                    variant="outline"
                    className="min-h-11 w-full rounded-xl"
                    onClick={() => navigate("/player/play")}
                  >
                    Find your next game
                  </Button>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
      <AlertDialog
        open={!!verify}
        onOpenChange={(open) => {
          if (!busy && !open) setVerify(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this score?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that the players and final score are correct. Report a
              problem if something needs fixing.
            </AlertDialogDescription>
            {verificationMatch && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm font-medium">
                Your {verificationMatch.partner_name ? "team" : "score"}:{" "}
                {verificationMatch.my_team === 1
                  ? verificationMatch.team1_score
                  : verificationMatch.team2_score}
                {" · "}Opponents:{" "}
                {verificationMatch.my_team === 1
                  ? verificationMatch.team2_score
                  : verificationMatch.team1_score}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {verificationMatch.match_date} ·{" "}
                  {verificationMatch.court_name}
                </span>
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void confirmScore();
              }}
            >
              {busy ? "Saving…" : "Confirm score"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Sheet
        open={!!reportId}
        onOpenChange={(open) => {
          if (!busy && !open) setReportId(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          <div className="mx-auto max-w-lg">
            <SheetHeader>
              <SheetTitle>Report a match problem</SheetTitle>
              <SheetDescription>
                Tell us what needs to be corrected.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <label
                htmlFor="match-issue"
                className="block text-sm font-medium"
              >
                Issue
              </label>
              <select
                id="match-issue"
                value={issueType}
                onChange={(event) => setIssueType(event.target.value)}
                disabled={busy}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select an issue
                </option>
                {issues.map((issue) => (
                  <option key={issue.value} value={issue.value}>
                    {issue.label}
                  </option>
                ))}
              </select>
              <label
                htmlFor="match-issue-details"
                className="block text-sm font-medium"
              >
                Details{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <Textarea
                id="match-issue-details"
                maxLength={500}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                disabled={busy}
                placeholder="What should we know?"
              />
              <p className="text-right text-xs text-muted-foreground">
                {details.length}/500
              </p>
              <Button
                disabled={busy || !issueType}
                onClick={() => void reportIssue()}
                className="min-h-11 w-full"
              >
                <Flag className="mr-2 h-4 w-4" />
                {busy ? "Submitting…" : "Submit report"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-9 text-center">
      <History
        className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60"
        aria-hidden="true"
      />
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
