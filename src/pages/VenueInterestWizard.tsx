import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  VenueInterestWizardCard,
  VenueInterestProgress,
  VenueInterestNavigation,
  useVenueInterestWizard,
  getInitialFormData,
  VenueTypeStep,
  PrimaryGoalStep,
  CurrentSetupStep,
  TimelineStep,
  EventVolumeStep,
  ContactFormStep,
  ConfirmationStep,
} from "@/components/venue-interest";

export default function VenueInterestWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(getInitialFormData());

  const { steps, totalSteps, isStepValid, getDynamicMessage } = useVenueInterestWizard(formData);
  const currentStep = steps[currentStepIndex];

  const updateFormData = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const goNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setDirection(1);
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("venue_inquiries").insert({
        venue_name: formData.venueName,
        contact_name: formData.contactName,
        email: formData.email,
        city: formData.city,
        state: formData.state,
        additional_info: formData.additionalNotes || null,
        venue_type: formData.venueType,
        primary_goals: formData.primaryGoals,
        current_setup: formData.currentSetup,
        timeline: formData.timeline,
        event_volume: formData.eventVolume || null,
      });

      if (error) throw error;

      toast.success("Thanks for your interest!");
      goNext(); // Go to confirmation step
    } catch (error) {
      console.error("Error submitting venue interest:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (currentStep.id === "contact") {
      handleSubmit();
    } else {
      goNext();
    }
  };

  const handleSkip = () => {
    goNext();
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case "venue-type":
        return (
          <VenueTypeStep
            value={formData.venueType}
            onChange={(v) => updateFormData("venueType", v)}
          />
        );
      case "primary-goal":
        return (
          <PrimaryGoalStep
            value={formData.primaryGoals}
            onChange={(v) => updateFormData("primaryGoals", v)}
          />
        );
      case "current-setup":
        return (
          <CurrentSetupStep
            value={formData.currentSetup}
            onChange={(v) => updateFormData("currentSetup", v)}
          />
        );
      case "timeline":
        return (
          <TimelineStep
            value={formData.timeline}
            onChange={(v) => updateFormData("timeline", v)}
          />
        );
      case "event-volume":
        return (
          <EventVolumeStep
            value={formData.eventVolume}
            onChange={(v) => updateFormData("eventVolume", v)}
          />
        );
      case "contact":
        return (
          <ContactFormStep
            venueName={formData.venueName}
            contactName={formData.contactName}
            email={formData.email}
            city={formData.city}
            state={formData.state}
            additionalNotes={formData.additionalNotes}
            onChange={(field, value) => updateFormData(field as keyof typeof formData, value)}
          />
        );
      case "confirmation":
        return <ConfirmationStep dynamicMessage={getDynamicMessage()} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <VenueInterestProgress
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        onBack={goBack}
        canGoBack={currentStepIndex > 0 && currentStep.id !== "confirmation"}
      />

      <div className="flex-1 px-4 py-6 pb-24 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <VenueInterestWizardCard key={currentStep.id} direction={direction}>
            {renderStep()}
          </VenueInterestWizardCard>
        </AnimatePresence>
      </div>

      <VenueInterestNavigation
        onContinue={handleContinue}
        onSkip={currentStep.isOptional ? handleSkip : undefined}
        isValid={isStepValid(currentStep.id)}
        isOptional={currentStep.isOptional}
        isLastStep={currentStep.id === "confirmation"}
        isContactStep={currentStep.id === "contact"}
        isLoading={isLoading}
      />
    </div>
  );
}
