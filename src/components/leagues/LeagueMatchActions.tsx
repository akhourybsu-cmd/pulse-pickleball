import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ActionButton } from "@/components/leagues/ActionButton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check, X, Pencil, ShieldAlert, Info, Flag,
} from "lucide-react";
import type { LeagueMatch, LeagueTeam } from "@/lib/leagues/types";
import { haptic } from "@/lib/haptics";

/**
 * Per-match action bar shown to a participant on the player league
 * detail page. Buttons vary by match status:
 *
 *   scheduled / in_progress → "Enter score"
 *   score_submitted (I didn't submit + haven't confirmed) → "Confirm" + "Dispute"
 *   score_submitted (I already confirmed or submitted) → subtle "waiting" note
 *   verified                → "Verified" pill (read-only)
 *   disputed                → "Disputed" pill + admin-resolves note
 *   canceled / forfeit      → nothing rendered
 *
 * `currentUserId` and `isParticipant` come from the parent so the
 * component doesn't need its own auth call.
 */
/**
 * Fire-and-forget nudge so a ladder can move on without the organizer. Safe
 * to call by anyone and idempotent server-side — it only advances a batch
 * that's genuinely complete and tie-free. No-op for non-ladder seasons
 * (ladderSeasonId undefined).
 */
async function nudgeLadderAdvance(ladderSeasonId?: string) {
  if (!ladderSeasonId) return;
  try {
    await supabase.functions.invoke("ladder-advance", {
      body: { season_id: ladderSeasonId },
    });
  } catch { /* best-effort; the organizer view / schedule will catch up */ }
}

export function LeagueMatchActions({
  match, teamsById, currentUserId, isParticipant, onChanged,
  sideALabel, sideBLabel, ladderSeasonId,
}: {
  match: LeagueMatch;
  teamsById: Record<string, LeagueTeam>;
  currentUserId: string;
  isParticipant: boolean;
  onChanged: () => void | Promise<void>;
  /** Individual-league side labels (e.g. ladder pairs). Fall back to team
   *  names when not supplied. */
  sideALabel?: string;
  sideBLabel?: string;
  /** When set, this match belongs to a ladder season; after a score is
   *  submitted/confirmed we nudge auto-advance so play continues without
   *  the organizer. */
  ladderSeasonId?: string;
}) {
  const [scoreOpen, setScoreOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  // Read-only bystanders: we don't render actions but we DO render
  // a small verified/disputed pill so the state is visible.
  if (!isParticipant) {
    return <StatusPill match={match} />;
  }

  const iSubmitted = match.score_submitted_by === currentUserId;
  const iConfirmed = match.verified_by?.includes(currentUserId) ?? false;

  if (match.status === "verified") {
    return (
      <div className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
        <Check className="w-3.5 h-3.5" />
        Verified
      </div>
    );
  }

  if (match.status === "disputed") {
    return (
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-destructive inline-flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" />
          Disputed — admin will resolve
        </div>
        {match.dispute_reason && (
          <div className="text-[11px] text-muted-foreground pl-4 italic">
            "{match.dispute_reason}"
          </div>
        )}
      </div>
    );
  }

  if (match.status === "canceled") return null;
  if (match.status === "forfeit") {
    const winnerName = match.forfeit_winner_team_id
      ? teamsById[match.forfeit_winner_team_id]?.name ?? null
      : null;
    return (
      <div className="text-[11px] font-semibold text-amber-600 inline-flex items-center gap-1">
        <Flag className="w-3.5 h-3.5" />
        Forfeit{winnerName ? ` — ${winnerName} wins` : ""}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {match.status === "score_submitted" ? (
        iConfirmed ? (
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Info className="w-3 h-3" />
            Waiting on another player to confirm
          </div>
        ) : (
          <>
            <ActionButton
              size="sm" variant="outline" className="h-8 text-xs"
              onClickAsync={async () => {
                const { error } = await supabase
                  .rpc("verify_league_match" as never, { p_match_id: match.id } as never);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success("Score confirmed");
                haptic("success");
                await nudgeLadderAdvance(ladderSeasonId);
                await onChanged();
              }}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Confirm
            </ActionButton>
            <ActionButton
              size="sm" variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setDisputeOpen(true)}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Dispute
            </ActionButton>
          </>
        )
      ) : null}

      {/* Enter/re-enter score. Always available to participants when
          the match isn't yet verified/canceled/forfeit. */}
      <ActionButton
        size="sm"
        variant={match.status === "score_submitted" ? "ghost" : "outline"}
        className="h-8 text-xs"
        onClick={() => setScoreOpen(true)}
      >
        <Pencil className="w-3.5 h-3.5 mr-1" />
        {match.status === "score_submitted"
          ? iSubmitted ? "Edit score" : "Fix score"
          : "Enter score"}
      </ActionButton>

      <SubmitScoreDialog
        open={scoreOpen}
        onOpenChange={setScoreOpen}
        match={match}
        teamsById={teamsById}
        sideALabel={sideALabel}
        sideBLabel={sideBLabel}
        ladderSeasonId={ladderSeasonId}
        onSubmitted={onChanged}
      />
      <DisputeDialog
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        matchId={match.id}
        onDisputed={onChanged}
      />
    </div>
  );
}

/* ---------- inner dialogs ---------- */

function SubmitScoreDialog({
  open, onOpenChange, match, teamsById, sideALabel, sideBLabel, ladderSeasonId, onSubmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  match: LeagueMatch;
  teamsById: Record<string, LeagueTeam>;
  sideALabel?: string;
  sideBLabel?: string;
  ladderSeasonId?: string;
  onSubmitted: () => void | Promise<void>;
}) {
  const [aScore, setAScore] = useState<string>(
    match.team_a_score !== null ? String(match.team_a_score) : "",
  );
  const [bScore, setBScore] = useState<string>(
    match.team_b_score !== null ? String(match.team_b_score) : "",
  );
  const [saving, setSaving] = useState(false);

  // Prefer explicit individual labels (ladder pairs); fall back to team names.
  const teamAName =
    sideALabel ?? (match.team_a_id && teamsById[match.team_a_id]?.name) ?? "Side A";
  const teamBName =
    sideBLabel ?? (match.team_b_id && teamsById[match.team_b_id]?.name) ?? "Side B";

  const parseScore = (s: string): number | null => {
    const trimmed = s.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0) return null;
    return n;
  };

  const submit = async () => {
    const a = parseScore(aScore);
    const b = parseScore(bScore);
    if (a === null || b === null) {
      toast.error("Enter non-negative whole numbers for both teams");
      return;
    }
    if (a === b) {
      toast.error("Scores can't be tied");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .rpc("submit_league_match_score" as never, {
        p_match_id: match.id,
        p_team_a_score: a,
        p_team_b_score: b,
      } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Score submitted — waiting for a teammate or opponent to confirm");
    haptic("success");
    onOpenChange(false);
    await nudgeLadderAdvance(ladderSeasonId);
    await onSubmitted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Enter score</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{teamAName}</Label>
              <Input
                type="number" inputMode="numeric" min={0}
                value={aScore}
                onChange={(e) => setAScore(e.target.value)}
                className="h-12 text-center text-lg font-bold tabular-nums"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{teamBName}</Label>
              <Input
                type="number" inputMode="numeric" min={0}
                value={bScore}
                onChange={(e) => setBScore(e.target.value)}
                className="h-12 text-center text-lg font-bold tabular-nums"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            One teammate or opponent needs to confirm before it locks in.
            League matches don't affect PULSE ratings.
          </p>
        </div>
        <DialogFooter>
          <ActionButton
            onClick={submit} loading={saving}
            className="w-full h-11"
          >
            Submit
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisputeDialog({
  open, onOpenChange, matchId, onDisputed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  onDisputed: () => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase
      .rpc("dispute_league_match" as never, {
        p_match_id: matchId,
        p_reason: reason.trim() || null,
      } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dispute recorded — an admin will review");
    setReason("");
    onOpenChange(false);
    await onDisputed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dispute this score</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The match will be flagged for admin review. They'll edit or
            re-verify from the admin console.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">What's wrong? (optional)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. score should be 11-9, not 11-7"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <ActionButton
            variant="ghost" className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </ActionButton>
          <ActionButton
            variant="destructive" className="flex-1"
            onClick={submit} loading={saving}
          >
            Submit dispute
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small badge shown to non-participants who happen to see the match
 * on their league page (e.g., a captain viewing all matches). Just a
 * one-word status hint — no actions.
 */
function StatusPill({ match }: { match: LeagueMatch }) {
  if (match.status === "verified") {
    return (
      <div className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
        <Check className="w-3.5 h-3.5" />
        Verified
      </div>
    );
  }
  if (match.status === "disputed") {
    return (
      <div className="text-[11px] font-semibold text-destructive inline-flex items-center gap-1">
        <ShieldAlert className="w-3.5 h-3.5" />
        Disputed
      </div>
    );
  }
  return null;
}
