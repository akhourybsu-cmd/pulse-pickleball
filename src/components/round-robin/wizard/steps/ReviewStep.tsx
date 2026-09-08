import { Pencil, Calendar, MapPin, Users, LayoutGrid, Target, TrendingUp, FileText, Zap, Lock, Globe, CheckCircle2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardFormData, calculateScheduleMetrics } from "../hooks/useWizardSteps";
import { StepHeader } from "../StepHeader";
import { cn } from "@/lib/utils";
import { PRESSABLE, PRESSABLE_CARD } from "@/lib/motion";
import { ScheduleImpactPreview } from "@/components/round-robin/ScheduleImpactPreview";
import { planCreationSchedulePreview } from "@/lib/roundRobin/creationSchedulePreview";

interface ReviewStepProps {
  formData: WizardFormData;
  onEdit: (stepIndex: number) => void;
  courts: { id: string; name: string; city: string; state: string }[];
}

interface ReviewItem {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Index into the wizard steps array to jump back to on edit. */
  stepIndex: number;
}

interface ReviewGroup {
  /** Stable id — used as React key. */
  id: string;
  title: string;
  /** Default step for the group's edit button (the first item's step). */
  editStepIndex: number;
  items: ReviewItem[];
}

/**
 * Review step — visual overhaul.
 *
 * Pre-overhaul: a flat list of ~10 rows, each with a tiny pencil icon, no
 * grouping, no hierarchy. Long values truncated mid-string. Felt like a
 * debug dump.
 *
 * Now: items are grouped into 3-4 logical cards (Basics / Schedule /
 * Ratings & access / Notes), each card has a single Edit button that
 * jumps to the matching wizard step. The fairness warning gets a
 * prominent banner above the cards instead of hiding at the bottom.
 *
 * No logic changes — same items, same step routing, same
 * calculateScheduleMetrics call.
 */
export function ReviewStep({ formData, onEdit }: ReviewStepProps) {
  const playerCount =
    formData.eventMode === "immediate"
      ? formData.playerInputMethod === "add"
        ? formData.selectedPlayers.length
        : formData.playerCount
      : formData.maxPlayers;

  const metrics = calculateScheduleMetrics(playerCount, formData.courtCount, formData.gamesPerPlayer);
  const rosterCompositionKnown = formData.eventMode === "immediate" &&
    formData.playerInputMethod === "add";
  const creationPlan = rosterCompositionKnown
    ? planCreationSchedulePreview({
        participants: formData.selectedPlayers,
        numCourts: formData.courtCount,
        gamesPerPlayer: formData.gamesPerPlayer,
        format: formData.format,
      })
    : null;
  const projectedRounds = creationPlan?.capacity.recommendedTotalRounds ?? metrics.rounds;

  const locationName =
    [formData.locationLabel.trim(), formData.cityLabel.trim()]
      .filter(Boolean)
      .join(" · ") || "Not specified";

  const formatLabels = {
    open: "Open",
    mixed: "Mixed",
    male: "Men's",
    female: "Women's",
  } as const;

  const ratingTypeLabels = {
    league: "League",
    ladder: "Ladder",
    playoffs: "Playoffs",
    casual: "Casual",
  } as const;

  // Step indices match useWizardSteps.ts:
  //   0=mode, 1=format, 2=details, 3=players, 4=schedule, 5=datetime,
  //   6=ratings, 7=review.
  const basics: ReviewItem[] = [
    {
      icon: FileText,
      label: "Event Name",
      value: formData.eventName || "Not set",
      stepIndex: 2,
    },
    {
      icon: Zap,
      label: "Mode",
      value: formData.eventMode === "immediate" ? "Immediate" : "Future event",
      stepIndex: 0,
    },
    {
      icon: Calendar,
      label: "Date & Time",
      value:
        formData.eventMode === "immediate"
          ? `Today · ${formData.startTime || "no time set"}`
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
  ];

  const schedule: ReviewItem[] = [
    {
      icon: Users,
      label: "Format",
      value: formatLabels[formData.format],
      stepIndex: 1,
    },
    {
      icon: Users,
      label: "Players",
      value: `${playerCount}`,
      stepIndex: 3,
    },
    {
      icon: LayoutGrid,
      label: "Courts",
      value: `${formData.courtCount}`,
      stepIndex: 4,
    },
    {
      icon: Target,
      label: "Games / player",
      value: `${formData.gamesPerPlayer} · ${projectedRounds} round${projectedRounds === 1 ? "" : "s"}`,
      stepIndex: 4,
    },
  ];

  const settings: ReviewItem[] = [
    {
      icon: TrendingUp,
      label: "Ratings",
      value: formData.ratingEligible
        ? `Counts · ${ratingTypeLabels[formData.ratingType]}`
        : "Not counted",
      stepIndex: 6,
    },
  ];

  // "Who can join" is only meaningful for open_registration events.
  if (formData.eventMode === "open_registration") {
    settings.push({
      icon: formData.isInviteOnly ? Lock : Globe,
      label: "Who can join",
      value: formData.isInviteOnly ? "Invite only" : "Open to everyone",
      stepIndex: 2,
    });
  }

  const groups: ReviewGroup[] = [
    { id: "basics", title: "Basics", editStepIndex: 2, items: basics },
    { id: "schedule", title: "Schedule", editStepIndex: 4, items: schedule },
    { id: "settings", title: "Ratings & access", editStepIndex: 6, items: settings },
  ];

  if (formData.notes) {
    groups.push({
      id: "notes",
      title: "Notes",
      editStepIndex: 2,
      items: [
        {
          icon: FileText,
          label: "What to know",
          value: formData.notes,
          stepIndex: 2,
        },
      ],
    });
  }

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={CheckCircle2}
        title="Looks right?"
        description="Tap any section to edit it."
      />

      <div className="flex-1 space-y-3 -mx-1">
        <ScheduleImpactPreview
          playerCount={playerCount}
          courtCount={formData.courtCount}
          gamesPerPlayer={formData.gamesPerPlayer}
          title="Your rotation"
          compact
          plan={creationPlan}
          mixedRosterEstimate={formData.format === "mixed" && !rosterCompositionKnown}
          showImpactSummary={false}
        />

        {groups.map((group) => (
          <div
            key={group.id}
            className={cn(
              "rounded-xl border border-border/60 bg-card overflow-hidden",
              "transition-colors hover:border-primary/30",
            )}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/40">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className={cn("group/edit h-7 -mr-2 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground", PRESSABLE)}
                onClick={() => onEdit(group.editStepIndex)}
              >
                <Pencil className="h-3 w-3 motion-safe:transition-transform motion-safe:group-hover/edit:-rotate-12" />
                Edit
              </Button>
            </div>

            <div className="divide-y divide-border/30">
              {group.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onEdit(item.stepIndex)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                      "transition-colors hover:bg-muted/40 active:bg-muted/60",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                      PRESSABLE_CARD,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground flex-shrink-0 w-24">
                      {item.label}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate flex-1">
                      {item.value}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
