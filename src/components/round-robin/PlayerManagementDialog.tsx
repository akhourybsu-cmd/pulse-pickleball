import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlayerPickerSheet, type PickerPlayer } from "./PlayerPickerSheet";
import {
  ArrowRight,
  Ban,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Route,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resolveRRParticipant, rrParticipantInitials } from "@/lib/roundRobin/resolveParticipant";
import { startPulseActivity } from "@/components/ui/pulse-activity";
import { ModalActions, ResponsiveSettingsModal } from "./ResponsiveSettingsModal";
import type { EventFormat } from "@/lib/roundRobin/scheduleCore";
import { normalizeBinaryGender } from "@/lib/roundRobin/participantGender";


interface Player {
  id: string;
  player_id: string | null;
  guest_player_id?: string | null;
  guest_name?: string | null;
  active: boolean;
  profiles: {
    id: string;
    full_name: string;
    display_name: string | null;
    avatar_url?: string | null;
    gender?: string | null;
  } | null;
  guest_players?: {
    id: string;
    display_name: string | null;
    linked_user_id: string | null;
    gender?: string | null;
    effective_gender?: string | null;
  } | null;
}

interface PlayerManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Player[];
  eventStatus: "draft" | "live" | "completed" | "voided";
  currentRound: number | null;
  totalRounds: number;
  hasSchedule: boolean;
  /** First round the schedule planner can safely rebuild after protected play. */
  firstAdjustableRound: number;
  /** Group this event is linked to (if any) — surfaces the Group tab in the picker. */
  groupId?: string | null;
  /** Restrict picker results when the event has a gender format. */
  genderFilter?: "male" | "female";
  /** Full format controls guest gender requirements, including mixed play. */
  eventFormat: EventFormat;
  /** When true, the event currently counts toward PULSE Ratings — used to warn
   *  the host that adding a guest substitute will drop that eligibility. */
  ratingEligible?: boolean;
  onAddPlayers: (inputs: Array<{
    playerId: string | null;
    guestPlayerId?: string | null;
    guestName?: string;
  }>) => Promise<number>;
  onMarkInactive: (playerEventId: string) => Promise<void>;
  /**
   * Substitute one roster member for another. The original is identified by
   * its round_robin_players row id (so guests work — they have no player_id),
   * and the replacement can be a registered player OR a guest.
   */
  onSubstitute: (
    originalRosterId: string,
    replacement: { playerId: string | null; guestPlayerId: string | null; guestName?: string },
    scope: 'global' | number,
  ) => Promise<void>;
}

type ActionMode = 'add' | 'remove' | 'substitute' | null;

export function PlayerManagementDialog({
  open,
  onOpenChange,
  players,
  eventStatus,
  currentRound,
  totalRounds,
  hasSchedule,
  firstAdjustableRound,
  groupId,
  genderFilter,
  eventFormat,
  ratingEligible = false,
  onAddPlayers,
  onMarkInactive,
  onSubstitute,
}: PlayerManagementDialogProps) {
  const [mode, setMode] = useState<ActionMode>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [addPicks, setAddPicks] = useState<PickerPlayer[]>([]);
  const [substituteOriginal, setSubstituteOriginal] = useState<string>("");
  const [substituteNewPick, setSubstituteNewPick] = useState<PickerPlayer | null>(null);
  const [substituteScope, setSubstituteScope] = useState<'global' | number>('global');
  const [loading, setLoading] = useState(false);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [justRemovedId, setJustRemovedId] = useState<string | null>(null);

  const activePlayers = players.filter(p => p.active);
  const inactivePlayers = players.filter(p => !p.active);
  const eventLocked = eventStatus === "completed" || eventStatus === "voided";
  const adjustmentStart = Math.max(1, Math.floor(firstAdjustableRound));
  const protectedRoundCount = Math.min(totalRounds, Math.max(0, adjustmentStart - 1));
  const adjustableRoundCount = Math.max(0, totalRounds - adjustmentStart + 1);
  const liveCurrentRound = eventStatus === "live" && currentRound != null &&
    currentRound >= 1 && currentRound <= totalRounds
    ? currentRound
    : null;
  const originalSubstitutePlayer = activePlayers.find(
    (player) => player.id === substituteOriginal,
  );
  const substituteGenderFilter = eventFormat === "mixed"
    ? normalizeBinaryGender(
        originalSubstitutePlayer?.profiles?.gender ??
          originalSubstitutePlayer?.guest_players?.effective_gender ??
          originalSubstitutePlayer?.guest_players?.gender,
      ) ?? undefined
    : genderFilter;

  // A round-scoped replacement is intentionally limited to the live round.
  // Future rows remain mutable and can be regenerated, so retaining a numeric
  // scope after the event advances would make the user's selection unsafe.
  useEffect(() => {
    if (typeof substituteScope === "number" && substituteScope !== liveCurrentRound) {
      setSubstituteScope("global");
    }
  }, [liveCurrentRound, substituteScope]);

  const handleAddPlayers = async () => {
    if (addPicks.length === 0) return;
    setLoading(true);
    const label = addPicks.length === 1
      ? `Adding ${addPicks[0].display_name || addPicks[0].full_name}…`
      : `Adding ${addPicks.length} players…`;
    const pulse = startPulseActivity(label);
    try {
      const addedCount = await onAddPlayers(
        addPicks.map((pick) => ({
          playerId: pick.isGuest ? null : pick.id,
          guestPlayerId: pick.isGuest ? pick.id : null,
          guestName: pick.isGuest ? pick.display_name || pick.full_name : undefined,
        })),
      );
      pulse.done(
        addedCount === 0
          ? "Already on the active roster"
          : addedCount === 1 && addPicks.length === 1
          ? `${addPicks[0].display_name || addPicks[0].full_name} is on the roster`
          : `${addedCount} ${addedCount === 1 ? "player" : "players"} added`,
      );
      setAddPicks([]);
      setMode(null);
    } catch (e) {
      pulse.fail();
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInactive = async () => {
    const targetId = confirmingRemoveId || selectedPlayer;
    if (!targetId) return;
    setLoading(true);
    setRemovingId(targetId);
    const pulse = startPulseActivity("Removing player & rebuilding rounds…");
    try {
      await onMarkInactive(targetId);
      pulse.done("Roster updated");
      setJustRemovedId(targetId);
      // Brief beat so the user sees the "Removed" flash before the dialog closes.
      await new Promise((resolve) => setTimeout(resolve, 650));
      setSelectedPlayer("");
      setConfirmingRemoveId(null);
      setMode(null);
    } catch (e) {
      pulse.fail();
      throw e;
    } finally {
      setLoading(false);
      setRemovingId(null);
      setJustRemovedId(null);
    }
  };

  const handleSubstitute = async () => {
    if (!substituteOriginal || !substituteNewPick) return;
    setLoading(true);
    const pulse = startPulseActivity("Substituting player…");
    try {
      const replacement = {
        playerId: substituteNewPick.isGuest ? null : substituteNewPick.id,
        guestPlayerId: substituteNewPick.isGuest ? substituteNewPick.id : null,
        guestName: substituteNewPick.isGuest
          ? (substituteNewPick.display_name || substituteNewPick.full_name)
          : undefined,
      };
      await onSubstitute(substituteOriginal, replacement, substituteScope);
      pulse.done(
        `${substituteNewPick.display_name || substituteNewPick.full_name} is in`,
      );
      setSubstituteOriginal("");
      setSubstituteNewPick(null);
      setSubstituteScope('global');
      setMode(null);
    } catch (e) {
      pulse.fail();
      throw e;
    } finally {
      setLoading(false);
    }
  };


  const handleClose = () => {
    setMode(null);
    setSelectedPlayer("");
    setAddPicks([]);
    setSubstituteOriginal("");
    setSubstituteNewPick(null);
    setSubstituteScope('global');
    setConfirmingRemoveId(null);
    onOpenChange(false);
  };

  return (
    <ResponsiveSettingsModal
      open={open}
      onOpenChange={(next) => { if (!next) handleClose(); }}
      title="Manage players"
      description="Handle arrivals, dropouts, and substitutes without losing completed play."
      className="sm:max-w-[680px]"
      footer={
        <ModalActions>
          {mode && (
            <Button
              variant="ghost"
              onClick={() => {
                setMode(null);
                setSelectedPlayer("");
                setAddPicks([]);
                setSubstituteOriginal("");
                setSubstituteNewPick(null);
                setSubstituteScope('global');
              }}
              className="text-muted-foreground hover:text-foreground sm:mr-auto"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {mode ? "Cancel" : "Close"}
          </Button>
          {mode === 'add' && (
            <Button onClick={handleAddPlayers} disabled={addPicks.length === 0 || loading} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              {loading
                ? "Adding…"
                : addPicks.length > 1
                  ? `Add ${addPicks.length} Players`
                  : "Add Player"}
            </Button>
          )}
          {mode === 'remove' && (
            <Button
              variant="outline"
              onClick={() => {
                setConfirmingRemoveId(null);
                setSelectedPlayer("");
              }}
              disabled={!confirmingRemoveId || loading}
              className="gap-1.5"
            >
              Clear selection
            </Button>
          )}
          {mode === 'substitute' && (
            <Button
              onClick={handleSubstitute}
              disabled={!substituteOriginal || !substituteNewPick || loading}
              className="gap-1.5"
            >
              <Users className="h-4 w-4" />
              {loading ? "Substituting…" : "Substitute Player"}
            </Button>
          )}
        </ModalActions>
      }
    >

        {!mode ? (
          <div className="relative space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2" aria-label="Roster change safeguards">
              <div className="min-w-0 rounded-xl border border-border/70 bg-card px-2.5 py-3 text-center">
                <Users className="mx-auto h-4 w-4 text-primary" />
                <div className="mt-1.5 text-xl font-bold leading-none tabular-nums">{activePlayers.length}</div>
                <div className="mt-1 text-[10px] font-medium text-muted-foreground">Active players</div>
              </div>
              <div className="min-w-0 rounded-xl border border-border/70 bg-card px-2.5 py-3 text-center">
                <LockKeyhole className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <div className="mt-1.5 text-xl font-bold leading-none tabular-nums">{protectedRoundCount}</div>
                <div className="mt-1 text-[10px] font-medium text-muted-foreground">Rounds protected</div>
              </div>
              <div className="min-w-0 rounded-xl border border-border/70 bg-card px-2.5 py-3 text-center">
                <Route className="mx-auto h-4 w-4 text-primary" />
                <div className="mt-1.5 text-xl font-bold leading-none tabular-nums">{adjustableRoundCount}</div>
                <div className="mt-1 text-[10px] font-medium text-muted-foreground">Rounds adjustable</div>
              </div>
            </div>

            {/* Action rows — one grouped glass card, accent icon tiles, hints.
                Matches the premium host-controls sheet language. */}
            <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden divide-y divide-border/60 shadow-[0_8px_30px_-16px_hsl(var(--foreground)/0.25)]">
              {[
                {
                  id: 'add' as const,
                  icon: UserPlus,
                  title: 'Add player',
                  description: hasSchedule
                    ? 'Late join — regenerates remaining rounds'
                    : 'Build the roster before generating matchups',
                  disabled: eventLocked,
                  tone: 'neutral' as const,
                },
                {
                  id: 'substitute' as const,
                  icon: Users,
                  title: 'Substitute player',
                  description: liveCurrentRound == null
                    ? 'Swap one player for all future rounds'
                    : `Swap globally or for the current live round (${liveCurrentRound})`,
                  disabled: eventLocked,
                  tone: 'neutral' as const,
                },
                {
                  id: 'remove' as const,
                  icon: UserMinus,
                  title: 'Remove from roster',
                  description: activePlayers.length <= 4
                    ? `Minimum 4 active players required (you have ${activePlayers.length})`
                    : 'Excludes player from future rounds; past scores preserved',
                  disabled: eventLocked || activePlayers.length <= 4,
                  tone: 'destructive' as const,
                },
              ].map((action) => {
                const Icon = action.icon;
                const isDestructive = action.tone === 'destructive';
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => !action.disabled && setMode(action.id)}
                    disabled={action.disabled}
                    className={cn(
                      "group w-full min-h-[60px] flex items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-muted/60 disabled:opacity-45 disabled:cursor-not-allowed",
                      isDestructive ? "bg-destructive/[0.04] hover:bg-destructive/[0.08]" : "hover:bg-muted/40",
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                      isDestructive
                        ? "bg-destructive/10 text-destructive border-destructive/25"
                        : "bg-primary/10 text-primary border-primary/20",
                    )}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-[15px] font-semibold leading-tight tracking-[-0.01em]",
                        isDestructive && "text-destructive",
                      )}>
                        {action.title}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug">
                        {action.description}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>


            {/* Roster — avatar + name rows grouped by active/inactive. */}
            <div className="pt-3 border-t border-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Active roster</span>
                <Badge variant="secondary" className="font-medium">{activePlayers.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {activePlayers.map((p) => {
                  const resolved = resolveRRParticipant(p);
                  const name = resolved.name;
                  const initials = rrParticipantInitials(resolved);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={resolved.avatarUrl || undefined} alt="" />
                        <AvatarFallback className="text-[10px] font-semibold bg-primary/15 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground truncate">{name}{resolved.isGuest && !resolved.isLinkedGuest ? ' (G)' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {inactivePlayers.length > 0 && (
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-muted-foreground">Inactive</span>
                  <Badge variant="outline" className="font-medium">{inactivePlayers.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {inactivePlayers.map((p) => {
                    const resolved = resolveRRParticipant(p);
                    const name = resolved.name;
                    const initials = rrParticipantInitials(resolved);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/20 opacity-60"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={resolved.avatarUrl || undefined} alt="" />
                          <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground truncate">{name}{resolved.isGuest && !resolved.isLinkedGuest ? ' (G)' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : mode === 'add' ? (
          <div className="space-y-4 py-4">
            <Alert>
              <UserPlus className="w-4 h-4" />
              <AlertDescription>
                {hasSchedule
                  ? <>Completed, scored, and live play stays protected. The automatic schedule rebuild begins with Round {adjustmentStart}.</>
                  : <>Add everyone to the roster first. No matchups are created until you choose Generate Schedule.</>}
              </AlertDescription>
            </Alert>

            {hasSchedule && adjustmentStart > 1 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2.5">
                <Route className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="font-semibold text-foreground">Late-join fairness is automatic.</strong>{" "}
                  New arrivals receive virtual scheduling credit for play completed before they joined. It guides future rotation only and never changes recorded games or standings.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Player to Add</Label>
              <PlayerPickerSheet
                mode="multi"
                allowGuest
                selectedPlayers={addPicks}
                onPlayersChange={setAddPicks}
                genderFilter={genderFilter}
                eventFormat={eventFormat}
                groupId={groupId}
                excludePlayerIds={[
                  // Active members only — an inactive row means they dropped
                  // out (removed/substituted) and re-adding them REACTIVATES
                  // that row, so they must stay pickable here.
                  ...players.filter(p => p.active).map(p => p.player_id).filter(Boolean) as string[],
                  ...players.filter(p => p.active).map(p => p.guest_player_id).filter(Boolean) as string[],
                ]}
                trigger={
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between rounded-lg border-2 border-dashed border-border p-3 text-left transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {addPicks.length === 1 ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={addPicks[0].avatar_url || undefined} alt="" />
                          <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                            {(addPicks[0].display_name || addPicks[0].full_name)
                              .split(" ").map(s => s[0]).filter(Boolean).slice(0,2).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {addPicks[0].display_name || addPicks[0].full_name}
                        </span>
                        {addPicks[0].isGuest && (
                          <Badge variant="outline" className="text-[10px] uppercase">guest</Badge>
                        )}
                      </div>
                    ) : addPicks.length > 1 ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex -space-x-2">
                          {addPicks.slice(0, 3).map((p) => (
                            <Avatar key={p.id} className="h-7 w-7 border-2 border-background">
                              <AvatarImage src={p.avatar_url || undefined} alt="" />
                              <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                                {(p.display_name || p.full_name)
                                  .split(" ").map(s => s[0]).filter(Boolean).slice(0,2).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        <span className="text-sm font-medium">
                          {addPicks.length} players selected
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserPlus className="h-4 w-4" />
                        <span className="text-sm">Choose from friends, group, recent, search, or guest</span>
                      </div>
                    )}
                    <Pencil className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                }
              />
            </div>

            {addPicks.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.055] px-3.5 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="tabular-nums">{activePlayers.length}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-primary tabular-nums">{activePlayers.length + addPicks.length} players</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {hasSchedule
                    ? <>Completed, scored, and live play stays untouched. Rebuilding begins with Round {adjustmentStart}, where game counts, rests, partners, and opponents adapt to the larger roster.</>
                    : <>The roster updates now. You will review courts, rests, game totals, and fairness before generating the first schedule.</>}
                </p>
              </div>
            )}
          </div>
        ) : mode === 'remove' ? (
          <div className="space-y-4 py-4">
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <UserMinus className="w-4 h-4" />
              <AlertDescription className="font-medium">
                This marks the player inactive for future scheduling. Completed, scored, and live play stays protected; automatic rebalancing begins with Round {adjustmentStart}. Minimum 4 active players required.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tap a player to remove</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AnimatePresence mode="popLayout">
                  {activePlayers.map((p) => {
                    const resolved = resolveRRParticipant(p);
                    const name = resolved.name;
                    const initials = rrParticipantInitials(resolved);
                    const isConfirming = confirmingRemoveId === p.id;
                    const isRemoving = removingId === p.id;
                    const isJustRemoved = justRemovedId === p.id;

                    return (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 1, scale: 1 }}
                        animate={{
                          opacity: isJustRemoved ? 0.5 : 1,
                          scale: isJustRemoved ? 0.97 : 1,
                          backgroundColor: isJustRemoved
                            ? 'hsl(var(--destructive) / 0.12)'
                            : isConfirming
                              ? 'hsl(var(--destructive) / 0.06)'
                              : 'hsl(var(--muted) / 0.4)',
                        }}
                        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
                        transition={{ duration: 0.18 }}
                        className={cn(
                          "relative flex flex-col gap-2 rounded-xl border p-3",
                          isConfirming
                            ? "border-destructive/40 shadow-sm"
                            : "border-transparent",
                          isJustRemoved && "border-destructive/50"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={resolved.avatarUrl || undefined} alt="" />
                            <AvatarFallback className="text-[11px] font-semibold bg-primary/15 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{name}</div>
                            {resolved.isGuest && !resolved.isLinkedGuest && (
                              <Badge variant="outline" className="text-[10px] uppercase w-fit">guest</Badge>
                            )}
                          </div>
                        </div>

                        {isJustRemoved ? (
                          <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                            <Ban className="h-4 w-4" />
                            Removed — schedule rebuilt
                          </div>
                        ) : isConfirming ? (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-destructive font-medium">
                              Remove {name} from future rounds?
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="min-h-11 flex-1"
                                onClick={() => setConfirmingRemoveId(null)}
                                disabled={isRemoving}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="min-h-11 flex-1 gap-1.5"
                                onClick={handleMarkInactive}
                                disabled={isRemoving}
                              >
                                {isRemoving ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserMinus className="h-3.5 w-3.5" />
                                )}
                                {isRemoving ? "Removing…" : "Remove"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-11 w-full gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setConfirmingRemoveId(p.id);
                              setSelectedPlayer(p.id);
                            }}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Remove from roster
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert>
              <Users className="w-4 h-4" />
              <AlertDescription>
                Substitute one player with another. Global replacement updates all future play.
                {liveCurrentRound == null
                  ? " Start the event before using a current-round-only replacement."
                  : ` A one-round replacement is available only for the current live round, Round ${liveCurrentRound}.`}
              </AlertDescription>
            </Alert>

            {adjustmentStart > 1 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2.5">
                <Route className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="font-semibold text-foreground">The replacement stays in the same fairness position.</strong>{" "}
                  For an all-future substitution, scheduling credit from protected play carries forward for rotation only. Match history and standings never change.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Original Player (to replace)</Label>
              {/* Keyed by round_robin_players.id (not player_id) so guests —
                  which have no player_id — are selectable here too. */}
              <Select value={substituteOriginal} onValueChange={setSubstituteOriginal}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose player to replace..." />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers.map(p => {
                    const resolved = resolveRRParticipant(p);
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {resolved.name}{resolved.isGuest && !resolved.isLinkedGuest ? ' (G)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {substituteOriginal && (
                <div className="text-sm text-muted-foreground mt-1">
                  Selected: <strong>{resolveRRParticipant(activePlayers.find(p => p.id === substituteOriginal) ?? {}).name}</strong>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>New Player (substitute)</Label>
              <PlayerPickerSheet
                mode="single"
                allowGuest
                selectedPlayers={substituteNewPick ? [substituteNewPick] : []}
                onPlayersChange={(arr) => {
                  const p = arr[0] ?? null;
                  setSubstituteNewPick(p);
                }}
                genderFilter={substituteGenderFilter}
                eventFormat={eventFormat}
                groupId={groupId}
                excludePlayerIds={[
                  // Active only — substituting a dropout back IN is a valid
                  // move (handleSubstitute reactivates their roster row).
                  ...players.filter(p => p.active).map(p => p.player_id).filter(Boolean) as string[],
                  ...players.filter(p => p.active).map(p => p.guest_player_id).filter(Boolean) as string[],
                ]}
                trigger={
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between rounded-lg border-2 border-dashed border-border p-3 text-left transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {substituteNewPick ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={substituteNewPick.avatar_url || undefined} alt="" />
                          <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                            {(substituteNewPick.display_name || substituteNewPick.full_name)
                              .split(" ").map(s => s[0]).filter(Boolean).slice(0,2).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {substituteNewPick.display_name || substituteNewPick.full_name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Choose replacement</span>
                      </div>
                    )}
                    <Pencil className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                }
              />
            </div>


            {substituteNewPick?.isGuest && ratingEligible && (
              <Alert variant="destructive" className="border-amber-500/40 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
                <Users className="w-4 h-4" />
                <AlertDescription>
                  Subbing in a guest will make this event no longer count toward PULSE Ratings.
                  Past results stay in players' history.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Scope</Label>
              <Select 
                value={substituteScope === 'global' ? 'global' : substituteScope.toString()} 
                onValueChange={(value) => setSubstituteScope(value === 'global' ? 'global' : parseInt(value))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">All Future Rounds (Global)</SelectItem>
                  {liveCurrentRound != null && (
                    <SelectItem value={liveCurrentRound.toString()}>
                      Current Round {liveCurrentRound} Only
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {liveCurrentRound == null
                  ? "Draft and future-round roster changes use All Future Rounds so regenerated schedules keep the replacement."
                  : "Current-round-only is for an unstarted, unscored match in the live round. Use All Future Rounds for later rounds or lasting roster changes."}
              </p>
            </div>

            {substituteOriginal && substituteNewPick && (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.055] px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="truncate">
                    {resolveRRParticipant(activePlayers.find(p => p.id === substituteOriginal) ?? {}).name}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-primary">
                    {substituteNewPick.display_name || substituteNewPick.full_name}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {substituteScope === "global"
                    ? `Completed, scored, and live play stays untouched. The automatic rebalance begins with Round ${adjustmentStart}.`
                    : `Only the current live round, Round ${substituteScope}, changes. Its match must still be unstarted and unlocked.`}
                </p>
              </div>
            )}
          </div>
        )}

    </ResponsiveSettingsModal>
  );
}
