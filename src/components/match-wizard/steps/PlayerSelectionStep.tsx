import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, ArrowLeftRight, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { MatchWizardFormData, PlayerSlot } from "../hooks/useMatchWizardSteps";

interface PlayerSelectionStepProps {
  formData: MatchWizardFormData;
  updateFormData: <K extends keyof MatchWizardFormData>(field: K, value: MatchWizardFormData[K]) => void;
}

interface Player {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  dupr_rating: number | null;
}

export function PlayerSelectionStep({ formData, updateFormData }: PlayerSelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [recentPlayers, setRecentPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestData, setGuestData] = useState({ name: '', notes: '' });

  const slotsPerTeam = formData.matchFormat === 'singles' ? 1 : 2;

  useEffect(() => {
    loadCurrentUserAndRecent();
  }, []);

  const loadCurrentUserAndRecent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setCurrentUserId(user.id);

    // Fetch current user profile so they can quick-pick themselves
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, avatar_url, dupr_rating')
      .eq('id', user.id)
      .single();

    if (profile) {
      setCurrentUserProfile(profile as Player);
    }

    // Load recent players from match history
    const { data: recentMatches } = await supabase
      .from('match_participants')
      .select('player_id')
      .neq('player_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentMatches) {
      const uniqueIds = [...new Set(recentMatches.map(m => m.player_id).filter(Boolean))].slice(0, 6);
      if (uniqueIds.length > 0) {
        const { data: players } = await supabase
          .from('profiles')
          .select('id, display_name, full_name, avatar_url, dupr_rating')
          .in('id', uniqueIds);
        if (players) {
          setRecentPlayers(players as Player[]);
        }
      }
    }
  };

  const searchPlayers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url, dupr_rating')
        .or(`display_name.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      setSearchResults((data || []) as Player[]);
    } catch (error) {
      console.error('Error searching players:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchPlayers(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchPlayers]);

  const getSelectedPlayerIds = (): Set<string> => {
    const ids = new Set<string>();
    [...formData.team1, ...formData.team2].forEach(slot => {
      if (slot.playerId) ids.add(slot.playerId);
    });
    return ids;
  };

  const findNextEmptySlot = (): { team: 'team1' | 'team2'; index: number } | null => {
    // Check Team 1 first
    for (let i = 0; i < slotsPerTeam; i++) {
      if (!formData.team1[i]?.playerId && !formData.team1[i]?.isGuest) {
        return { team: 'team1', index: i };
      }
    }
    // Then Team 2
    for (let i = 0; i < slotsPerTeam; i++) {
      if (!formData.team2[i]?.playerId && !formData.team2[i]?.isGuest) {
        return { team: 'team2', index: i };
      }
    }
    return null;
  };

  const handlePlayerSelect = (player: Player) => {
    const nextSlot = findNextEmptySlot();
    if (!nextSlot) return;

    const newTeam = [...formData[nextSlot.team]];
    newTeam[nextSlot.index] = { playerId: player.id, isGuest: false };
    updateFormData(nextSlot.team, newTeam);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddGuest = () => {
    if (!guestData.name.trim()) return;
    
    const nextSlot = findNextEmptySlot();
    if (!nextSlot) return;

    const newTeam = [...formData[nextSlot.team]];
    newTeam[nextSlot.index] = {
      playerId: null,
      isGuest: true,
      guestName: guestData.name.trim(),
      guestNotes: guestData.notes.trim() || undefined,
    };
    updateFormData(nextSlot.team, newTeam);
    setShowGuestModal(false);
    setGuestData({ name: '', notes: '' });
  };

  const handleRemovePlayer = (team: 'team1' | 'team2', index: number) => {
    // Don't allow removing current user from slot 0
    if (team === 'team1' && index === 0 && formData.team1[0]?.playerId === currentUserId) {
      return;
    }

    const newTeam = [...formData[team]];
    newTeam[index] = { playerId: null, isGuest: false };
    updateFormData(team, newTeam);
  };

  const handleSwapTeams = () => {
    const oldTeam1 = [...formData.team1];
    const oldTeam2 = [...formData.team2];
    updateFormData('team1', oldTeam2);
    updateFormData('team2', oldTeam1);
  };

  const selectedIds = getSelectedPlayerIds();
  const filteredResults = searchResults.filter(p => !selectedIds.has(p.id));
  const filteredRecent = recentPlayers.filter(p => !selectedIds.has(p.id));

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-muted-foreground text-center">
        Who played?
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Searching...</div>
          ) : filteredResults.length > 0 ? (
            filteredResults.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                onClick={() => handlePlayerSelect(player)}
              />
            ))
          ) : (
            <div className="text-center text-sm text-muted-foreground py-4">
              No players found
            </div>
          )}
        </div>
      )}

      {/* Quick Pick Chips */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-2">
          {filteredRecent.slice(0, 4).map(player => (
            <Badge
              key={player.id}
              variant="secondary"
              className="cursor-pointer hover:bg-accent py-1.5 px-3"
              onClick={() => handlePlayerSelect(player)}
            >
              {player.display_name || player.full_name}
            </Badge>
          ))}
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent py-1.5 px-3"
            onClick={() => setShowGuestModal(true)}
          >
            <UserPlus className="h-3 w-3 mr-1" />
            Add Guest
          </Badge>
        </div>
      )}

      {/* Team Panels */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <TeamPanel
          label="Team 1"
          slots={formData.team1.slice(0, slotsPerTeam)}
          currentUserId={currentUserId}
          onRemove={(index) => handleRemovePlayer('team1', index)}
        />
        <TeamPanel
          label="Team 2"
          slots={formData.team2.slice(0, slotsPerTeam)}
          currentUserId={currentUserId}
          onRemove={(index) => handleRemovePlayer('team2', index)}
        />
      </div>

      {/* Swap Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleSwapTeams}
      >
        <ArrowLeftRight className="h-4 w-4 mr-2" />
        Swap Teams
      </Button>

      {/* Guest Modal */}
      <Dialog open={showGuestModal} onOpenChange={setShowGuestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Guest Player</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-name">Display Name *</Label>
              <Input
                id="guest-name"
                placeholder="Guest's name"
                value={guestData.name}
                onChange={(e) => setGuestData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-notes">Notes (optional)</Label>
              <Textarea
                id="guest-notes"
                placeholder="e.g., visiting friend"
                value={guestData.notes}
                onChange={(e) => setGuestData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGuestModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGuest} disabled={!guestData.name.trim()}>
              Add Guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PlayerCardProps {
  player: Player;
  onClick: () => void;
}

function PlayerCard({ player, onClick }: PlayerCardProps) {
  return (
    <Card
      className="p-3 cursor-pointer hover:bg-accent transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={player.avatar_url || undefined} />
          <AvatarFallback>
            {(player.display_name || player.full_name || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {player.display_name || player.full_name}
          </div>
          {player.dupr_rating && (
            <div className="text-xs text-muted-foreground">{player.dupr_rating.toFixed(2)}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

interface TeamPanelProps {
  label: string;
  slots: PlayerSlot[];
  currentUserId: string | null;
  onRemove: (index: number) => void;
}

function TeamPanel({ label, slots, currentUserId, onRemove }: TeamPanelProps) {
  return (
    <Card className="p-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
      <div className="space-y-2">
        {slots.map((slot, index) => (
          <SlotDisplay
            key={index}
            slot={slot}
            isCurrentUser={slot.playerId === currentUserId}
            onRemove={() => onRemove(index)}
          />
        ))}
      </div>
    </Card>
  );
}

interface SlotDisplayProps {
  slot: PlayerSlot;
  isCurrentUser: boolean;
  onRemove: () => void;
}

function SlotDisplay({ slot, isCurrentUser, onRemove }: SlotDisplayProps) {
  const [playerName, setPlayerName] = useState<string | null>(null);

  useEffect(() => {
    if (slot.playerId && !slot.isGuest) {
      loadPlayerName(slot.playerId);
    }
  }, [slot.playerId, slot.isGuest]);

  const loadPlayerName = async (playerId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, full_name')
      .eq('id', playerId)
      .single();
    
    if (data) {
      setPlayerName(data.display_name || data.full_name || 'Unknown');
    }
  };

  if (!slot.playerId && !slot.isGuest) {
    return (
      <div className="h-10 rounded-md border-2 border-dashed border-muted flex items-center justify-center">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  const displayName = slot.isGuest ? slot.guestName : (isCurrentUser ? 'You' : playerName);

  return (
    <div className={`h-10 rounded-md flex items-center justify-between px-3 ${
      slot.isGuest ? 'border-2 border-dashed border-primary/50 bg-primary/5' : 'bg-muted'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate text-sm">{displayName || 'Loading...'}</span>
        {slot.isGuest && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">GUEST</Badge>
        )}
      </div>
      {!isCurrentUser && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
