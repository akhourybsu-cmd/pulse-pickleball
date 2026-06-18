import { useState } from "react";
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
import { Pencil } from "lucide-react";
import { UserPlus, UserMinus, Users, ChevronRight, ChevronLeft } from "lucide-react";
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

interface Player {
  id: string;
  player_id: string;
  active: boolean;
  profiles: {
    id: string;
    full_name: string;
    display_name: string | null;
  };
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
  onAddPlayer: (input: { playerId: string | null; guestName?: string }) => Promise<void>;
  onMarkInactive: (playerEventId: string) => Promise<void>;
  onSubstitute: (originalPlayerId: string, newPlayerId: string, scope: 'global' | number) => Promise<void>;
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
  onAddPlayer,
  onMarkInactive,
  onSubstitute,
}: PlayerManagementDialogProps) {
  const [mode, setMode] = useState<ActionMode>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [addPick, setAddPick] = useState<PickerPlayer | null>(null);
  const [substituteOriginal, setSubstituteOriginal] = useState<string>("");
  const [substituteNew, setSubstituteNew] = useState<string>("");
  const [substituteNewPick, setSubstituteNewPick] = useState<PickerPlayer | null>(null);
  const [substituteScope, setSubstituteScope] = useState<'global' | number>('global');
  const [loading, setLoading] = useState(false);
  const [substituteNewName, setSubstituteNewName] = useState<string>("");

  const activePlayers = players.filter(p => p.active);
  const inactivePlayers = players.filter(p => !p.active);

  const handleAddPlayer = async () => {
    if (!selectedPlayer) return;
    setLoading(true);
    try {
      await onAddPlayer(selectedPlayer);
      setSelectedPlayer("");
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInactive = async () => {
    if (!selectedPlayer) return;
    setLoading(true);
    try {
      await onMarkInactive(selectedPlayer);
      setSelectedPlayer("");
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubstitute = async () => {
    if (!substituteOriginal || !substituteNew) return;
    setLoading(true);
    try {
      await onSubstitute(substituteOriginal, substituteNew, substituteScope);
      setSubstituteOriginal("");
      setSubstituteNew("");
      setSubstituteScope('global');
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode(null);
    setSelectedPlayer("");
    setSubstituteOriginal("");
    setSubstituteNew("");
    setSubstituteScope('global');
    onOpenChange(false);
  };

  const getPlayerName = async (playerId: string) => {
    const player = players.find(p => p.player_id === playerId);
    if (player) {
      return player.profiles.display_name || player.profiles.full_name || "Unknown";
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
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Players</DialogTitle>
          <DialogDescription>
            Add, remove, or substitute players. Changes will regenerate future rounds.
          </DialogDescription>
        </DialogHeader>

        {!mode ? (
          <div className="space-y-4 py-2">
            {/* Action cards — icon tile + title + description + chevron.
                Consistent with the dashboard QuickActions tile style so the
                visual language carries across the organizer experience. */}
            <div className="space-y-2">
              {[
                {
                  id: 'add' as const,
                  icon: UserPlus,
                  title: 'Add Player',
                  description: 'Late join — regenerates remaining rounds',
                  disabled: false,
                },
                {
                  id: 'remove' as const,
                  icon: UserMinus,
                  title: 'Remove From Roster',
                  description: activePlayers.length <= 4
                    ? `Minimum 4 active players required (you have ${activePlayers.length})`
                    : 'Excludes player from future rounds; past scores preserved',
                  disabled: activePlayers.length <= 4,
                },
                {
                  id: 'substitute' as const,
                  icon: Users,
                  title: 'Substitute Player',
                  description: 'Swap one player for another, globally or for a single round',
                  disabled: false,
                },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => !action.disabled && setMode(action.id)}
                    disabled={action.disabled}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card text-left"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{action.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{action.description}</div>
                    </div>
                    {!action.disabled && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
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
                  const name = p.profiles.display_name || p.profiles.full_name || 'Player';
                  const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
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
                      <span className="text-sm text-foreground truncate">{name}</span>
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
                    const name = p.profiles.display_name || p.profiles.full_name || 'Player';
                    const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
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
                        <span className="text-sm text-muted-foreground truncate">{name}</span>
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
              <Label>Select Player to Add</Label>
              <PlayerSelector
                value={selectedPlayer}
                onValueChange={setSelectedPlayer}
                placeholder="Search for a player..."
                excludePlayerIds={players.map(p => p.player_id)}
              />
            </div>
          </div>
        ) : mode === 'remove' ? (
          <div className="space-y-4 py-4">
            <Alert>
              <UserMinus className="w-4 h-4" />
              <AlertDescription>
                Marking a player inactive removes them from Round {currentRound || 1} onward.
                Past rounds remain unchanged. Minimum 4 active players required.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Select Player to Mark Inactive</Label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a player..." />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.profiles.display_name || p.profiles.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={substituteOriginal} onValueChange={setSubstituteOriginal}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose player to replace..." />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers.map(p => (
                    <SelectItem key={p.id} value={p.player_id}>
                      {p.profiles.display_name || p.profiles.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {substituteOriginal && (
                <div className="text-sm text-muted-foreground mt-1">
                  Selected: <strong>{activePlayers.find(p => p.player_id === substituteOriginal)?.profiles.display_name || activePlayers.find(p => p.player_id === substituteOriginal)?.profiles.full_name}</strong>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>New Player (substitute)</Label>
              <PlayerSelector
                value={substituteNew}
                onValueChange={async (value) => {
                  setSubstituteNew(value);
                  if (value) {
                    const name = await getPlayerName(value);
                    setSubstituteNewName(name);
                  } else {
                    setSubstituteNewName("");
                  }
                }}
                placeholder="Search for replacement player..."
                excludePlayerIds={substituteOriginal ? [substituteOriginal] : []}
              />
              {substituteNew && substituteNewName && (
                <div className="text-sm text-muted-foreground mt-1">
                  Selected: <strong>{substituteNewName}</strong>
                </div>
              )}
            </div>

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
            <Button onClick={handleAddPlayer} disabled={!selectedPlayer || loading} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              {loading ? "Adding…" : "Add Player"}
            </Button>
          )}
          {mode === 'remove' && (
            <Button onClick={handleMarkInactive} disabled={!selectedPlayer || loading} variant="destructive" className="gap-1.5">
              <UserMinus className="h-4 w-4" />
              {loading ? "Removing…" : "Remove From Roster"}
            </Button>
          )}
          {mode === 'substitute' && (
            <Button
              onClick={handleSubstitute}
              disabled={!substituteOriginal || !substituteNew || loading}
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
