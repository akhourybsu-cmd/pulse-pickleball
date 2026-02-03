import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Clock, DollarSign } from "lucide-react";
import { formatTournamentLabel, formatSkillLevelRange, formatGenderLabel, formatAgeGroupLabel } from "@/lib/formatLabels";
import { differenceInDays, isPast } from "date-fns";

interface Division {
  id: string;
  name: string;
  format: string;
  max_teams: number | null;
  description: string | null;
  skill_level_min?: number | null;
  skill_level_max?: number | null;
  age_group?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  gender?: string | null;
  play_type?: string | null;
  registration_fee?: number | null;
  early_bird_fee?: number | null;
  early_bird_deadline?: string | null;
}

interface DivisionWithCounts extends Division {
  spotsRemaining: number;
  isFull: boolean;
}

interface RegistrationStepDivisionProps {
  divisions: Division[];
  eventId: string;
  selectedDivisionId: string;
  onSelectDivision: (divisionId: string) => void;
  eventFee?: number | null;
}

export function RegistrationStepDivision({
  divisions,
  eventId,
  selectedDivisionId,
  onSelectDivision,
  eventFee,
}: RegistrationStepDivisionProps) {
  const [divisionsWithCounts, setDivisionsWithCounts] = useState<DivisionWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDivisionCounts();
  }, [divisions]);

  const fetchDivisionCounts = async () => {
    const divisionsData = await Promise.all(
      divisions.map(async (division) => {
        const { count: teamsCount } = await supabase
          .from("tournaments_teams")
          .select("*", { count: "exact", head: true })
          .eq("division_id", division.id);

        const { count: registrationsCount } = await supabase
          .from("tournament_registrations")
          .select("*", { count: "exact", head: true })
          .eq("division_id", division.id)
          .in("status", ["confirmed", "pending"]);

        const maxTeams = division.max_teams || 999;
        const currentTeams = (teamsCount || 0) + (registrationsCount || 0);
        const spotsRemaining = Math.max(0, maxTeams - currentTeams);

        return {
          ...division,
          spotsRemaining,
          isFull: spotsRemaining === 0,
        };
      })
    );

    setDivisionsWithCounts(divisionsData);
    setLoading(false);
  };

  const getEarlyBirdInfo = (division: Division) => {
    if (!division.early_bird_fee || !division.early_bird_deadline) return null;
    const deadline = new Date(division.early_bird_deadline);
    if (isPast(deadline)) return null;
    
    const daysLeft = differenceInDays(deadline, new Date());
    const regularFee = division.registration_fee || eventFee || 0;
    
    return {
      fee: division.early_bird_fee,
      regularFee,
      savings: regularFee - division.early_bird_fee,
      daysLeft,
    };
  };

  const getCurrentPrice = (division: Division) => {
    const earlyBird = getEarlyBirdInfo(division);
    if (earlyBird) return earlyBird.fee;
    return division.registration_fee || eventFee || 0;
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading divisions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Division</h3>
        <p className="text-sm text-muted-foreground">
          Choose the division you'd like to register for
        </p>
      </div>

      <RadioGroup value={selectedDivisionId} onValueChange={onSelectDivision}>
        <div className="space-y-3">
          {divisionsWithCounts.map((division) => {
            const hasSkillLevel = division.skill_level_min || division.skill_level_max;
            const hasAgeRestriction = division.age_group || division.age_min || division.age_max;
            const earlyBird = getEarlyBirdInfo(division);
            const currentPrice = getCurrentPrice(division);

            return (
              <div
                key={division.id}
                className={`border rounded-lg p-4 ${
                  selectedDivisionId === division.id ? "border-primary bg-primary/5" : ""
                } ${division.isFull ? "opacity-60" : "cursor-pointer hover:border-primary/50"}`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value={division.id}
                    id={division.id}
                    disabled={division.isFull}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Label
                        htmlFor={division.id}
                        className={`text-base font-medium ${division.isFull ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {division.name}
                      </Label>
                      {currentPrice > 0 && (
                        <div className="text-right">
                          {earlyBird ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground line-through">${earlyBird.regularFee}</span>
                              <span className="text-base font-semibold text-green-600">${earlyBird.fee}</span>
                            </div>
                          ) : (
                            <span className="text-base font-semibold">${currentPrice}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {division.description && (
                      <p className="text-sm text-muted-foreground">
                        {division.description}
                      </p>
                    )}

                    {/* Eligibility & Format Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatTournamentLabel(division.format)}</Badge>
                      
                      {division.gender && division.gender !== "open" && (
                        <Badge variant="secondary" className="text-xs">
                          {formatGenderLabel(division.gender)}
                        </Badge>
                      )}
                      
                      {hasSkillLevel && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                          <Trophy className="h-3 w-3 mr-1" />
                          {formatSkillLevelRange(division.skill_level_min, division.skill_level_max)}
                        </Badge>
                      )}
                      
                      {hasAgeRestriction && (
                        <Badge variant="secondary" className="text-xs">
                          {formatAgeGroupLabel(division.age_group, division.age_min, division.age_max)}
                        </Badge>
                      )}
                    </div>

                    {/* Early Bird Notice */}
                    {earlyBird && earlyBird.daysLeft <= 7 && (
                      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded">
                        <Clock className="h-3 w-3" />
                        <span>
                          Early bird ends in {earlyBird.daysLeft} {earlyBird.daysLeft === 1 ? "day" : "days"} - Save ${earlyBird.savings.toFixed(0)}
                        </span>
                      </div>
                    )}

                    {/* Spots Info */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {division.spotsRemaining} spot{division.spotsRemaining !== 1 ? "s" : ""} left
                        </span>
                      </div>
                      {division.isFull && (
                        <Badge variant="destructive">Full</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </RadioGroup>

      {divisionsWithCounts.every((d) => d.isFull) && (
        <div className="text-center py-4 text-muted-foreground">
          All divisions are currently full. Please check back later or contact the organizer.
        </div>
      )}
    </div>
  );
}
