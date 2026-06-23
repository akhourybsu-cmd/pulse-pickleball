import { Pencil, Calendar, MapPin, Users, LayoutGrid, Target, TrendingUp, FileText, Zap, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardFormData, calculateScheduleMetrics } from "../hooks/useWizardSteps";

interface ReviewStepProps {
  formData: WizardFormData;
  onEdit: (stepIndex: number) => void;
  courts: { id: string; name: string; city: string; state: string }[];
}

export function ReviewStep({ formData, onEdit, courts }: ReviewStepProps) {
  const playerCount = formData.eventMode === "immediate" 
    ? (formData.selectedPlayers.length || formData.playerCount)
    : formData.maxPlayers;
  
  const metrics = calculateScheduleMetrics(playerCount, formData.courtCount, formData.gamesPerPlayer);
  
  const locationName =
    [formData.locationLabel.trim(), formData.cityLabel.trim()]
      .filter(Boolean)
      .join(" · ") || "Not specified";


  const formatLabels = {
    open: "Open",
    mixed: "Mixed",
    male: "Men's",
    female: "Women's",
  };

  const ratingTypeLabels = {
    league: "League",
    ladder: "Ladder",
    playoffs: "Playoffs",
    casual: "Casual",
  };

  // Step indices match the 8-step wizard order in useWizardSteps.ts:
  //   0=mode, 1=format, 2=details, 3=players, 4=schedule, 5=datetime,
  //   6=ratings, 7=review. Name/Location/Notes all live in step 2 (Details);
  //   Courts/Games both live in step 4 (Schedule).
  const items = [
    {
      icon: FileText,
      label: "Event Name",
      value: formData.eventName || "Not set",
      stepIndex: 2,
    },
    {
      icon: Zap,
      label: "Mode",
      value: formData.eventMode === "immediate" ? "Immediate Event" : "Future Event",
      stepIndex: 0,
    },
    {
      icon: Calendar,
      label: "Date & Time",
      value: formData.eventMode === "immediate"
        ? `Today @ ${formData.startTime || "Not set"}`
        : formData.eventDate
          ? new Date(formData.eventDate).toLocaleString()
          : "Not set",
      stepIndex: 5,
    },
    {
      icon: MapPin,
      label: "Location",
      value: locationName,
      stepIndex: 2,
    },
    {
      icon: Users,
      label: "Format",
      value: formatLabels[formData.format],
      stepIndex: 1,
    },
    {
      icon: Users,
      label: "Players",
      value: `${playerCount} players`,
      stepIndex: 3,
    },
    {
      icon: LayoutGrid,
      label: "Courts",
      value: `${formData.courtCount} ${formData.courtCount === 1 ? "court" : "courts"}`,
      stepIndex: 4,
    },
    {
      icon: Target,
      label: "Games/Player",
      value: `${formData.gamesPerPlayer} games → ${metrics.rounds} rounds`,
      stepIndex: 4,
    },
    {
      icon: TrendingUp,
      label: "Ratings",
      value: formData.ratingEligible
        ? `Yes (${ratingTypeLabels[formData.ratingType]})`
        : "No",
      stepIndex: 6,
    },
  ];

  // Show "Who can join?" only when the picker is actually relevant
  // (open_registration events). Immediate-mode events never surface the
  // toggle in DetailsStep, so listing it on Review would be confusing.
  if (formData.eventMode === "open_registration") {
    items.push({
      icon: formData.isInviteOnly ? Lock : Globe,
      label: "Who can join",
      value: formData.isInviteOnly
        ? "Invite only (hidden from discovery)"
        : "Open to everyone",
      stepIndex: 2,
    });
  }

  if (formData.notes) {
    items.push({
      icon: FileText,
      label: "Notes",
      value: formData.notes.substring(0, 50) + (formData.notes.length > 50 ? "..." : ""),
      stepIndex: 2,
    });
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Review your Round Robin</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Confirm the details before creating
      </p>

      <div className="flex-1 -mx-2">
        <div className="space-y-1">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground flex-shrink-0">{item.label}</span>
                  <span className="text-sm font-medium truncate">{item.value}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => onEdit(item.stepIndex)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        {metrics.fairnessWarning && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ {metrics.fairnessWarning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
