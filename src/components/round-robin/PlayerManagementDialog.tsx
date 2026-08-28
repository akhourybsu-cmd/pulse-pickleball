import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlayerPickerSheet, type PickerPlayer } from "./PlayerPickerSheet";
import { Pencil, Ban, RefreshCw } from "lucide-react";
import { UserPlus, UserMinus, Users, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { resolveRRParticipant, rrParticipantInitials } from "@/lib/roundRobin/resolveParticipant";

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
  } | null;
  guest_players?: {
    id: string;
    display_name: string | null;
    linked_user_id: string | null;
  } | null;
}

interface PlayerManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Player[];
  currentRound: number | null;
  totalRounds: number;
  /** Group this event is linked to (if any) — surfaces the Group tab in the picker. */
  groupId?: string | null;
  /** Restrict picker results when the event has a gender format. */
  genderFilter?: "male" | "female";
  /** When true, the event currently counts toward PULSE Ratings — used to warn
   *  the host that adding a guest substitute will drop that eligibility. */
  ratingEligible?: boolean;
  onAddPlayer: (input: { playerId: string | null; guestPlayerId?: string | null; guestName?: string }) => Promise<void>;
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
  currentRound,
  totalRounds,
  groupId,
  genderFilter,
  ratingEligible = false,
  onAddPlayer,
  onMarkInactive,
  onSubstitute,
}: PlayerManagementDialogProps) {
  const [mode, setMode] = useState<ActionMode>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [addPicks, setAddPicks] = useState<PickerPlayer[]>([]);
  const [substituteOriginal, setSubstituteOriginal] = useState<string>("");
  const [substituteNew, setSubstituteNew] = useState<string>("");
  const [substituteNewPick, setSubstituteNewPick] = useState<PickerPlayer | null>(null);
  const [substituteScope, setSubstituteScope] = useState<'global' | number>('global');
  const [loading, setLoading] = useState(false);
  const [substituteNewName, setSubstituteNewName] = useState<string>("");
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [justRemovedId, setJustRemovedId] = useState<string | null>(null);

  const activePlayers = players.filter(p => p.active);
  const inactivePlayers = players.filter(p => !p.active);

  const handleAddPlayer = async () => {
    if (addPicks.length === 0) return;
    setLoading(true);
    try {
      for (const pick of addPicks) {
        await onAddPlayer({
          playerId: pick.isGuest ? null : pick.id,
          guestPlayerId: pick.isGuest ? pick.id : null,
          guestName: pick.isGuest ? pick.display_name || pick.full_name : undefined,
        });
      }
      setAddPicks([]);
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInactive = async () => {
    const targetId = confirmingRemoveId || selectedPlayer;
    if (!targetId) return;
    setLoading(true);
    setRemovingId(targetId);
    try {
      await onMarkInactive(targetId);
      setJustRemovedId(targetId);
      // Brief beat so the user sees the "Removed" flash before the dialog closes.
      await new Promise((resolve) => setTimeout(resolve, 650));
      setSelectedPlayer("");
      setConfirmingRemoveId(null);
      setMode(null);
    } finally {
      setLoading(false);
      setRemovingId(null);
      setJustRemovedId(null);
    }
  };

  const handleSubstitute = async () => {
    if (!substituteOriginal || !substituteNewPick) return;
    setLoading(true);
    try {
      const replacement = {
        playerId: substituteNewPick.isGuest ? null : substituteNewPick.id,
        guestPlayerId: substituteNewPick.isGuest ? substituteNewPick.id : null,
        guestName: substituteNewPick.isGuest
          ? (substituteNewPick.display_name || substituteNewPick.full_name)
          : undefined,
      };
      await onSubstitute(substituteOriginal, replacement, substituteScope);
      setSubstituteOriginal("");
      setSubstituteNew("");
      setSubstituteNewPick(null);
      setSubstituteScope('global');
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode(null);
    setSelectedPlayer("");
    setAddPicks([]);
    setSubstituteOriginal("");
    setSubstituteNew("");
    setSubstituteScope('global');
    onOpenChange(false);
  };

  const getPlayerName = async (playerId: string) => {
    const player = players.find(p => p.player_id === playerId);
    if (player) {
      return resolveRRParticipant(player as any).name;
    }

    // If not in players list, fetch from database (for new substitutes)
    const { data } = await supabase
      .from('profiles_public')
      .select('display_name, full_name')
      .eq('id', playerId)
      .single();

    return data?.display_name || data?.full_name || "Unknown";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-xl border-border/70">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.10] to-transparent"
        />
        <DialogHeader className="relative text-left">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
            Round Robin
          </div>
          <DialogTitle asChild>
            <div className="text-[20px] font-extrabold tracking-[-0.01em] leading-tight">
              Manage players
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs leading-snug">
            Add, remove, or substitute players. Changes will regenerate future rounds.
          </DialogDescription>
        </DialogHeader>

        {!mode ? (
          <div className="relative space-y-4 py-2">
            {/* Action rows — one grouped glass card, accent icon tiles, hints.
                Matches the premium host-controls sheet language. */}
            <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden divide-y divide-border/60 shadow-[0_8px_30px_-16px_hsl(var(--foreground)/0.25)]">
              {[
                {
                  id: 'add' as const,
                  icon: UserPlus,
                  title: 'Add player',
                  description: 'Late join — regenerates remaining rounds',
                  disabled: false,
                  tone: 'neutral' as const,
                },
                {
                  id: 'substitute' as const,
                  icon: Users,
                  title: 'Substitute player',
                  description: 'Swap one player for another, globally or for a single round',
                  disabled: false,
                  tone: 'neutral' as const,
                },
                {
                  id: 'remove' as const,
                  icon: UserMinus,
                  title: 'Remove from roster',
                  description: activePlayers.length <= 4
                    ? `Minimum 4 active players required (you have ${activePlayers.length})`
                    : 'Excludes player from future rounds; past scores preserved',
                  disabled: activePlayers.length <= 4,
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
                  const resolved = resolveRRParticipant(p as any);
                  const name = resolved.name;
                  const initials = rrParticipantInitials(resolved);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40"
                    >
                      <Avatar className="h-6 w-6">
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
                    const resolved = resolveRRParticipant(p as any);
                    const name = resolved.name;
                    const initials = rrParticipantInitials(resolved);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/20 opacity-60"
                      >
                        <Avatar className="h-6 w-6">
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
                Adding a player will regenerate all rounds from Round {currentRound || 1} onward.
                Past rounds and completed matches will remain unchanged.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Player to Add</Label>
              <PlayerPickerSheet
                mode="multi"
                allowGuest
                selectedPlayers={addPicks}
                onPlayersChange={setAddPicks}
                genderFilter={genderFilter}
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
                    className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-all text-left"
                  >
                    {addPicks.length === 1 ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7">
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
          </div>
        ) : mode === 'remove' ? (
          <div className="space-y-4 py-4">
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <UserMinus className="w-4 h-4" />
              <AlertDescription className="font-medium">
                Removing a player marks them inactive from Round {currentRound || 1} onward.
                Past rounds and scores stay untouched. Minimum 4 active players required.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tap a player to remove</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AnimatePresence mode="popLayout">
                  {activePlayers.map((p) => {
                    const resolved = resolveRRParticipant(p as any);
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
                                className="flex-1"
                                onClick={() => setConfirmingRemoveId(null)}
                                disabled={isRemoving}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1 gap-1.5"
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
                            className="w-full gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                Substitute one player with another. Choose whether to replace globally (all future rounds) 
                or for a specific round only.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Original Player (to replace)</Label>
              {/* Keyed by round_robin_players.id (not player_id) so guests —
                  which have no player_id — are selectable here too. */}
              <Select value={substituteOriginal} onValueChange={setSubstituteOriginal}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose player to replace..." />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers.map(p => {
                    const resolved = resolveRRParticipant(p as any);
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
                  Selected: <strong>{resolveRRParticipant((activePlayers.find(p => p.id === substituteOriginal) ?? {}) as any).name}</strong>
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
                  setSubstituteNew(p?.id ?? "");
                  setSubstituteNewName(p ? (p.display_name || p.full_name) : "");
                }}
                genderFilter={genderFilter}
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
                    className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-all text-left"
                  >
                    {substituteNewPick ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7">
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">All Future Rounds (Global)</SelectItem>
                  {Array.from({ length: totalRounds - (currentRound || 1) + 1 }, (_, i) => (
                    <SelectItem 
                      key={i} 
                      value={((currentRound || 1) + i).toString()}
                    >
                      Round {(currentRound || 1) + i} Only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {mode && (
            <Button
              variant="ghost"
              onClick={() => {
                setMode(null);
                setSelectedPlayer("");
                setAddPicks([]);
                setSubstituteOriginal("");
                setSubstituteNew("");
                setSubstituteScope('global');
              }}
              className="mr-auto text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {mode === 'add' && (
            <Button onClick={handleAddPlayer} disabled={addPicks.length === 0 || loading} className="gap-1.5">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
