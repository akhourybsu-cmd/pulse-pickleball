import { useState, useEffect } from "react";
import { Trophy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MatchWizardFormData, PlayerSlot } from "../hooks/useMatchWizardSteps";

interface ScoreEntryStepProps {
  formData: MatchWizardFormData;
  updateFormData: <K extends keyof MatchWizardFormData>(field: K, value: MatchWizardFormData[K]) => void;
}

const SCORE_PRESETS = [11, 15, 21];

export function ScoreEntryStep({ formData, updateFormData }: ScoreEntryStepProps) {
  const [team1Names, setTeam1Names] = useState<string[]>([]);
  const [team2Names, setTeam2Names] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const slotsPerTeam = formData.matchFormat === 'singles' ? 1 : 2;

  useEffect(() => {
    loadPlayerNames();
  }, [formData.team1, formData.team2]);

  const loadPlayerNames = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const loadTeamNames = async (slots: PlayerSlot[]): Promise<string[]> => {
      const names: string[] = [];
      for (const slot of slots.slice(0, slotsPerTeam)) {
        if (slot.isGuest) {
          names.push(slot.guestName || 'Guest');
        } else if (slot.playerId) {
          if (slot.playerId === user?.id) {
            names.push('You');
          } else {
            const { data } = await supabase
              .from('profiles')
              .select('display_name, full_name')
              .eq('id', slot.playerId)
              .single();
            names.push(data?.display_name || data?.full_name || 'Unknown');
          }
        }
      }
      return names;
    };

    const [t1Names, t2Names] = await Promise.all([
      loadTeamNames(formData.team1),
      loadTeamNames(formData.team2),
    ]);
    setTeam1Names(t1Names);
    setTeam2Names(t2Names);
  };

  const handleWinnerSelect = (winner: 1 | 2) => {
    updateFormData('winner', winner);
    // Reset scores when winner changes
    if (selectedPreset && selectedPreset !== 'custom') {
      updateFormData('winnerScore', selectedPreset);
      updateFormData('loserScore', null);
    }
  };

  const handlePresetSelect = (preset: number | 'custom') => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      updateFormData('winnerScore', preset);
      // Clear loser score to let user input
      updateFormData('loserScore', null);
    }
  };

  const handleLoserScoreChange = (value: string) => {
    const score = parseInt(value);
    if (!isNaN(score) && score >= 0) {
      updateFormData('loserScore', score);
    } else if (value === '') {
      updateFormData('loserScore', null);
    }
  };

  const handleCustomWinnerScore = (value: string) => {
    const score = parseInt(value);
    if (!isNaN(score) && score >= 0) {
      updateFormData('winnerScore', score);
    } else if (value === '') {
      updateFormData('winnerScore', null);
    }
  };

  const formatTeamName = (names: string[]) => {
    if (names.length === 0) return 'Team';
    if (names.length === 1) return names[0];
    return names.join(' & ');
  };

  const isScoreValid = formData.winnerScore !== null && 
                       formData.loserScore !== null && 
                       formData.winnerScore > formData.loserScore;

  return (
    <div className="space-y-6">
      {/* Winner Selection */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground text-center">
          Who won?
        </div>
        
        <div className="space-y-2">
          <Card
            className={`p-4 cursor-pointer transition-all ${
              formData.winner === 1
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:bg-accent'
            }`}
            onClick={() => handleWinnerSelect(1)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {formData.winner === 1 ? (
                    <Trophy className="h-5 w-5 text-primary" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">1</span>
                  )}
                </div>
                <div>
                  <div className="font-medium">{formatTeamName(team1Names)}</div>
                  <div className="text-xs text-muted-foreground">Team 1</div>
                </div>
              </div>
              {formData.winner === 1 && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer transition-all ${
              formData.winner === 2
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:bg-accent'
            }`}
            onClick={() => handleWinnerSelect(2)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {formData.winner === 2 ? (
                    <Trophy className="h-5 w-5 text-primary" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">2</span>
                  )}
                </div>
                <div>
                  <div className="font-medium">{formatTeamName(team2Names)}</div>
                  <div className="text-xs text-muted-foreground">Team 2</div>
                </div>
              </div>
              {formData.winner === 2 && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Score Entry - Only show after winner selected */}
      {formData.winner && (
        <div className="space-y-4">
          <div className="text-sm font-medium text-muted-foreground text-center">
            Final Score
          </div>

          {/* Score Presets */}
          <div className="flex gap-2">
            {SCORE_PRESETS.map(preset => (
              <Button
                key={preset}
                variant={selectedPreset === preset ? "default" : "outline"}
                className="flex-1"
                onClick={() => handlePresetSelect(preset)}
              >
                {preset}
              </Button>
            ))}
            <Button
              variant={selectedPreset === 'custom' ? "default" : "outline"}
              className="flex-1"
              onClick={() => handlePresetSelect('custom')}
            >
              Custom
            </Button>
          </div>

          {/* Score Input */}
          {selectedPreset && (
            <div className="flex items-center gap-4 justify-center">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Winner</div>
                {selectedPreset === 'custom' ? (
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={formData.winnerScore ?? ''}
                    onChange={(e) => handleCustomWinnerScore(e.target.value)}
                    className="w-20 text-center text-2xl font-bold h-14"
                    min={0}
                    max={99}
                  />
                ) : (
                  <div className="w-20 h-14 flex items-center justify-center bg-primary/10 rounded-md text-2xl font-bold text-primary">
                    {selectedPreset}
                  </div>
                )}
              </div>
              
              <div className="text-2xl font-bold text-muted-foreground">—</div>
              
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Loser</div>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={formData.loserScore ?? ''}
                  onChange={(e) => handleLoserScoreChange(e.target.value)}
                  className="w-20 text-center text-2xl font-bold h-14"
                  placeholder="?"
                  min={0}
                  max={formData.winnerScore ? formData.winnerScore - 1 : 99}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Validation feedback */}
          {formData.loserScore !== null && formData.winnerScore !== null && !isScoreValid && (
            <div className="text-center text-sm text-destructive">
              Winner's score must be higher than loser's score
            </div>
          )}
        </div>
      )}
    </div>
  );
}
