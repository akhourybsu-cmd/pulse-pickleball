import { useMemo } from "react";

export interface VenueInterestFormData {
  // Wizard steps
  venueType: string;
  primaryGoals: string[];
  currentSetup: string;
  timeline: string;
  eventVolume: string;
  
  // Contact form
  venueName: string;
  contactName: string;
  email: string;
  city: string;
  state: string;
  additionalNotes: string;
}

export interface WizardStep {
  id: string;
  label: string;
  isOptional: boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: "venue-type", label: "Venue Type", isOptional: false },
  { id: "primary-goal", label: "Goals", isOptional: false },
  { id: "current-setup", label: "Current Setup", isOptional: false },
  { id: "timeline", label: "Timeline", isOptional: false },
  { id: "event-volume", label: "Event Volume", isOptional: true },
  { id: "contact", label: "Contact", isOptional: false },
  { id: "confirmation", label: "Done", isOptional: false },
];

export function useVenueInterestWizard(formData: VenueInterestFormData) {
  const steps = useMemo(() => WIZARD_STEPS, []);

  const getStepValidation = (stepId: string): boolean => {
    switch (stepId) {
      case "venue-type":
        return !!formData.venueType;
      case "primary-goal":
        return formData.primaryGoals.length > 0;
      case "current-setup":
        return !!formData.currentSetup;
      case "timeline":
        return !!formData.timeline;
      case "event-volume":
        return true; // Optional step
      case "contact":
        return (
          formData.venueName.trim().length > 0 &&
          formData.contactName.trim().length > 0 &&
          formData.email.trim().length > 0 &&
          formData.city.trim().length > 0 &&
          formData.state.trim().length > 0
        );
      case "confirmation":
        return true;
      default:
        return false;
    }
  };

  const getDynamicMessage = (): string => {
    if (formData.primaryGoals.includes("hosting_events")) {
      return "We'll help you launch your first event.";
    }
    if (formData.primaryGoals.includes("venue_presence")) {
      return "We'll help you create your venue presence.";
    }
    if (formData.primaryGoals.includes("community")) {
      return "We'll help you grow your pickleball community.";
    }
    return "We'll walk you through Pulse step-by-step.";
  };

  return {
    steps,
    totalSteps: steps.length,
    isStepValid: getStepValidation,
    getStepIndex: (stepId: string) => steps.findIndex((s) => s.id === stepId),
    getStepById: (stepId: string) => steps.find((s) => s.id === stepId),
    getDynamicMessage,
  };
}

export function getInitialFormData(): VenueInterestFormData {
  return {
    venueType: "",
    primaryGoals: [],
    currentSetup: "",
    timeline: "",
    eventVolume: "",
    venueName: "",
    contactName: "",
    email: "",
    city: "",
    state: "",
    additionalNotes: "",
  };
}
