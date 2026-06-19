import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, MapPin, Trophy, AlertCircle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { MatchWizardFormData, PlayerSlot } from "../hooks/useMatchWizardSteps";

interface ReviewStepProps {
  formData: MatchWizardFormData;
  updateFormData: <K extends keyof MatchWizardFormData>(field: K, value: MatchWizardFormData[K]) => void;
}

interface PlayerInfo {
  name: string;
  isGuest: boolean;
}

export function ReviewStep({ formData, updateFormData }: ReviewStepProps) {
  const [team1Players, setTeam1Players] = useState<PlayerInfo[]>([]);
  const [team2Players, setTeam2Players] = useState<PlayerInfo[]>([]);
  const [locationName, setLocationName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const slotsPerTeam = formData.matchFormat === 'singles' ? 1 : 2;
  
  const hasGuests = [...formData.team1, ...formData.team2]
    .slice(0, slotsPerTeam * 2)
    .some(slot => slot.isGuest);

  useEffect(() => {
    loadAllData();
  }, [formData]);

  // Auto-disable ratings if guests present
  useEffect(() => {
    if (hasGuests && formData.updateRatings) {
      updateFormData('updateRatings', false);
    }
  }, [hasGuests]);

  const loadAllData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    // Load player names
    const loadTeamPlayers = async (slots: PlayerSlot[]): Promise<PlayerInfo[]> => {
      const players: PlayerInfo[] = [];
      for (const slot of slots.slice(0, slotsPerTeam)) {
        if (slot.isGuest) {
          players.push({ name: slot.guestName || 'Guest', isGuest: true });
        } else if (slot.playerId) {
          if (slot.playerId === user?.id) {
            players.push({ name: 'You', isGuest: false });
          } else {
            const { data } = await supabase
              .from('profiles')
              .select('display_name, full_name')
              .eq('id', slot.playerId)
              .single();
            players.push({ 
              name: data?.display_name || data?.full_name || 'Unknown', 
              isGuest: false 
            });
          }
        }
      }
      return players;
    };

    const [t1, t2] = await Promise.all([
      loadTeamPlayers(formData.team1),
      loadTeamPlayers(formData.team2),
    ]);
    setTeam1Players(t1);
    setTeam2Players(t2);

    // Location label — the wizard now stores a city/town string in
    // customLocation.name; we no longer reach into the courts table.
    if (formData.customLocation) {
      const loc = formData.customLocation;
      setLocationName(
        loc.name?.trim() ||
          [loc.city, loc.state].filter(Boolean).join(', ') ||
          'Unknown Location'
      );
    } else {
      setLocationName('Unknown Location');
    }
  };

  const winningTeam = formData.winner === 1 ? team1Players : team2Players;
  const losingTeam = formData.winner === 1 ? team2Players : team1Players;
  const winnerScore = formData.winnerScore;
  const loserScore = formData.loserScore;

  // Presentational rating-eligibility status — describes what WILL happen on
  // submit using existing form state. This does not change any rating logic;
  // it only surfaces the system's behavior so the player isn't surprised.
  //
  // The four honest states map to:
  //  - guests present       → ratings are auto-disabled by existing logic
  //  - toggle off           → "casual" save with no rating impact
  //  - real players only    → submits as pending; rating impact waits on verification
  //  - toggle on but solo   → defensive fallback (shouldn't normally hit valid review)
  const eligibility: {
    tone: 'amber' | 'green' | 'muted';
    label: string;
    description: string;
  } = (() => {
    if (hasGuests) {
      return {
        tone: 'amber',
        label: 'Guest players — no rating impact',
        description: "Guest players don't have PULSE ratings, so this match won't change anyone's rating. It will still be saved to your history.",
      };
    }
    if (!formData.updateRatings) {
      return {
        tone: 'muted',
        label: 'Casual match — saved to history',
        description: "This match won't change PULSE ratings. Toggle Update Ratings below if you want it to count.",
      };
    }
    return {
      tone: 'green',
      label: 'Likely rating eligible — pending verification',
      description: 'Other players will be asked to verify the result. Ratings update once enough players confirm.',
    };
  })();

  const eligibilityToneClasses: Record<typeof eligibility.tone, string> = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    green: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
    muted: 'bg-muted border-border text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div className="text-sm font-medium text-muted-foreground text-center">
        Review Match
      </div>

      {/* Match Info */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {format(new Date(formData.matchDate), 'EEEE, MMMM d, yyyy')}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {locationName || 'Loading...'}
        </div>
        <Badge variant="secondary" className="mt-2">
          {formData.matchFormat === 'singles' ? 'Singles' : 'Doubles'}
        </Badge>
      </Card>

      {/* Teams & Score */}
      <div className="grid grid-cols-2 gap-3">
        {/* Winner */}
        <Card className={`p-4 ${formData.winner === 1 ? 'ring-2 ring-primary' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">Winner</span>
          </div>
          <div className="space-y-1">
            {winningTeam.map((player, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-medium text-sm">{player.name}</span>
                {player.isGuest && (
                  <Badge variant="outline" className="text-[10px] px-1">GUEST</Badge>
                )}
              </div>
            ))}
          </div>
          <div className="text-3xl font-bold text-primary mt-3">{winnerScore}</div>
        </Card>

        {/* Loser */}
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {formData.winner === 1 ? 'Team 2' : 'Team 1'}
          </div>
          <div className="space-y-1">
            {losingTeam.map((player, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-medium text-sm">{player.name}</span>
                {player.isGuest && (
                  <Badge variant="outline" className="text-[10px] px-1">GUEST</Badge>
                )}
              </div>
            ))}
          </div>
          <div className="text-3xl font-bold text-muted-foreground mt-3">{loserScore}</div>
        </Card>
      </div>

      {/* Rating eligibility — honest preview of what will happen on submit */}
      <div className={`p-3 rounded-lg border ${eligibilityToneClasses[eligibility.tone]}`}>
        <p className="text-sm font-medium leading-tight">{eligibility.label}</p>
        <p className="text-xs mt-1 leading-snug opacity-90">{eligibility.description}</p>
      </div>

      {/* Rating Toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="update-ratings" className="font-medium">
              Update Ratings
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Adjusts player ratings based on match outcome</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Switch
            id="update-ratings"
            checked={formData.updateRatings}
            onCheckedChange={(checked) => updateFormData('updateRatings', checked)}
            disabled={hasGuests}
          />
        </div>
        
        {hasGuests && (
          <div className="flex items-start gap-2 mt-3 p-3 bg-muted rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              Rating updates are disabled because guest players are present. Guest players don't have ratings in the system.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
