import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface Division {
  id: string;
  name: string;
  format: string;
  max_teams: number | null;
  description: string | null;
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
}

export function RegistrationStepDivision({
  divisions,
  eventId,
  selectedDivisionId,
  onSelectDivision,
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
          {divisionsWithCounts.map((division) => (
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
                <div className="flex-1">
                  <Label
                    htmlFor={division.id}
                    className={`text-base font-medium ${division.isFull ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {division.name}
                  </Label>
                  {division.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {division.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline">{division.format}</Badge>
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
          ))}
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
