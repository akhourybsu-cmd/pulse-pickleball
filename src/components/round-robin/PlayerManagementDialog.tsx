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
import { PlayerSelector } from "./PlayerSelector";
import { UserPlus, UserMinus, UserX, Users } from "lucide-react";
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
  onAddPlayer: (playerId: string) => Promise<void>;
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
  onAddPlayer,
  onMarkInactive,
  onSubstitute,
}: PlayerManagementDialogProps) {
  const [mode, setMode] = useState<ActionMode>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [substituteOriginal, setSubstituteOriginal] = useState<string>("");
  const [substituteNew, setSubstituteNew] = useState<string>("");
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
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setMode('add')}
            >
              <UserPlus className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Add Player (Late Join)</div>
                <div className="text-sm text-muted-foreground">
                  Add a player and regenerate remaining rounds
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setMode('remove')}
              disabled={activePlayers.length <= 4}
            >
              <UserMinus className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Remove Player From Roster</div>
                <div className="text-sm text-muted-foreground">
                  Remove player from future rounds (past scores preserved)
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setMode('substitute')}
            >
              <Users className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Substitute Player</div>
                <div className="text-sm text-muted-foreground">
                  Replace one player with another for specific or all rounds
                </div>
              </div>
            </Button>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Active Players</span>
                <Badge variant="secondary">{activePlayers.length}</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                {activePlayers.map(p => (
                  <div key={p.id}>• {p.profiles.display_name || p.profiles.full_name}</div>
                ))}
              </div>
            </div>

            {inactivePlayers.length > 0 && (
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Inactive Players</span>
                  <Badge variant="outline">{inactivePlayers.length}</Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {inactivePlayers.map(p => (
                    <div key={p.id}>• {p.profiles.display_name || p.profiles.full_name}</div>
                  ))}
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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {mode === 'add' && (
            <Button onClick={handleAddPlayer} disabled={!selectedPlayer || loading}>
              {loading ? "Adding..." : "Add Player"}
            </Button>
          )}
          {mode === 'remove' && (
            <Button onClick={handleMarkInactive} disabled={!selectedPlayer || loading} variant="destructive">
              {loading ? "Removing..." : "Remove From Roster"}
            </Button>
          )}
          {mode === 'substitute' && (
            <Button 
              onClick={handleSubstitute} 
              disabled={!substituteOriginal || !substituteNew || loading}
            >
              {loading ? "Substituting..." : "Substitute"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
