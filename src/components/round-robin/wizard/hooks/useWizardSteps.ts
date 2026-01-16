import { useMemo } from "react";

export interface WizardFormData {
  eventMode: "immediate" | "open_registration";
  eventName: string;
  locationId: string;
  format: "open" | "mixed" | "male" | "female";
  selectedPlayers: { id: string; full_name: string; display_name: string | null; gender?: string | null }[];
  playerCount: number;
  playerInputMethod: "add" | "count" | null;
  courtCount: number;
  gamesPerPlayer: number;
  eventDate: string;
  startTime: string;
  registrationDeadline: string;
  ratingEligible: boolean;
  ratingType: "ladder" | "league" | "playoffs" | "casual";
  notes: string;
  isPublished: boolean;
  maxPlayers: number;
}

export interface WizardStep {
  id: string;
  label: string;
  isOptional: boolean;
}

const ALL_STEPS: WizardStep[] = [
  { id: "mode", label: "Event Mode", isOptional: false },
  { id: "name", label: "Event Name", isOptional: false },
  { id: "location", label: "Location", isOptional: true },
  { id: "format", label: "Format", isOptional: false },
  { id: "players", label: "Players", isOptional: false },
  { id: "courts", label: "Courts", isOptional: false },
  { id: "games", label: "Games", isOptional: false },
  { id: "datetime", label: "Date & Time", isOptional: false },
  { id: "ratings", label: "Ratings", isOptional: false },
  { id: "notes", label: "Notes", isOptional: true },
  { id: "review", label: "Review", isOptional: false },
];

export function useWizardSteps(formData: WizardFormData) {
  const visibleSteps = useMemo(() => {
    // All steps are visible - dynamic logic could hide steps if needed
    return ALL_STEPS;
  }, []);

  const getStepValidation = (stepId: string): boolean => {
    switch (stepId) {
      case "mode":
        return !!formData.eventMode;
      case "name":
        return formData.eventName.trim().length > 0;
      case "location":
        return true; // Optional
      case "format":
        return !!formData.format;
      case "players":
        if (formData.eventMode === "immediate") {
          return formData.selectedPlayers.length >= 4;
        }
        return formData.maxPlayers >= 4;
      case "courts":
        return formData.courtCount >= 1;
      case "games":
        return formData.gamesPerPlayer >= 1;
      case "datetime":
        if (formData.eventMode === "immediate") {
          return !!formData.startTime;
        }
        // For open registration: need date, time, and valid deadline (deadline before event)
        if (!formData.eventDate || !formData.startTime || !formData.registrationDeadline) {
          return false;
        }
        // Validate deadline is before event
        try {
          return new Date(formData.registrationDeadline) < new Date(formData.eventDate);
        } catch {
          return false;
        }
      case "ratings":
        if (formData.ratingEligible) {
          return !!formData.ratingType;
        }
        return true;
      case "notes":
        return true; // Optional
      case "review":
        return true;
      default:
        return false;
    }
  };

  return {
    steps: visibleSteps,
    totalSteps: visibleSteps.length,
    isStepValid: getStepValidation,
    getStepIndex: (stepId: string) => visibleSteps.findIndex((s) => s.id === stepId),
    getStepById: (stepId: string) => visibleSteps.find((s) => s.id === stepId),
  };
}

// Helper to generate default event name
export function generateDefaultEventName(): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const now = new Date();
  const hour = now.getHours();
  const dayName = days[now.getDay()];
  
  let timeOfDay = "Morning";
  if (hour >= 12 && hour < 17) timeOfDay = "Afternoon";
  else if (hour >= 17) timeOfDay = "Evening";
  
  return `${dayName} ${timeOfDay} Round Robin`;
}

// Calculate schedule metrics (preserved from original)
export function calculateScheduleMetrics(
  playerCount: number,
  courtCount: number,
  gamesPerPlayer: number
) {
  const P = playerCount;
  const C = courtCount;
  const G = gamesPerPlayer;

  if (P < 4 || C < 1 || G < 1) {
    return { rounds: 0, totalSlots: 0, capacity: 0, fairnessWarning: null };
  }

  const maxPossibleMatches = Math.floor(P / 4);
  const matchesPerRound = Math.min(C, maxPossibleMatches);
  const onCourtPerRound = 4 * matchesPerRound;
  const gamesPerRoundPerPlayer = onCourtPerRound / P;
  const rounds = Math.ceil(G / gamesPerRoundPerPlayer);
  const totalSlots = P * G;
  const capacity = onCourtPerRound;

  const totalPartnerSlots = P * G;
  const uniquePartnersAvailable = P - 1;
  const repeatPartnersNeeded = Math.max(0, totalPartnerSlots - uniquePartnersAvailable * rounds);

  let fairnessWarning: string | null = null;
  if (matchesPerRound < C) {
    fairnessWarning = `Only ${matchesPerRound} of ${C} courts will be used`;
  } else if (repeatPartnersNeeded > 0) {
    fairnessWarning = `Some players may have repeat partners`;
  } else if (P % 4 !== 0) {
    fairnessWarning = "Players will rotate sit-outs fairly";
  }

  return { rounds, totalSlots, capacity, fairnessWarning };
}
