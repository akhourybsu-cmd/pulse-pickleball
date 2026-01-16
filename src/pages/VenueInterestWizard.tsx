import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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
import { ThankYouStep } from "@/components/venue-interest/steps/ThankYouStep";

export default function VenueInterestWizard() {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(getInitialFormData());
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"create" | "info" | null>(null);

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
      const { data, error } = await supabase
        .from("venue_inquiries")
        .insert({
          venue_name: formData.venueName,
          contact_name: formData.contactName,
          email: formData.email,
          city: formData.city,
          state: formData.state,
          message: formData.additionalNotes || null,
          venue_type: formData.venueType,
          primary_goals: formData.primaryGoals,
          current_setup: formData.currentSetup,
          timeline: formData.timeline,
          event_volume: formData.eventVolume || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      setInquiryId(data.id);
      toast.success("Thanks for your interest!");
      goNext(); // Go to confirmation step
    } catch (error) {
      console.error("Error submitting venue interest:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const notifyPulseAdmins = async (id: string, intent: "create_now" | "info_request") => {
    try {
      await supabase.functions.invoke("notify-venue-inquiry", {
        body: {
          inquiryId: id,
          venueName: formData.venueName,
          contactName: formData.contactName,
          email: formData.email,
          city: formData.city,
          state: formData.state,
          venueType: formData.venueType,
          primaryGoals: formData.primaryGoals,
          currentSetup: formData.currentSetup,
          timeline: formData.timeline,
          eventVolume: formData.eventVolume,
          additionalNotes: formData.additionalNotes,
          intent,
        },
      });
    } catch (error) {
      // Log but don't fail the flow if notification fails
      console.error("Failed to notify admins:", error);
    }
  };

  const handleCreateNow = async () => {
    if (!inquiryId) {
      console.error("No inquiry ID found - inquiry may not have been saved");
      toast.error("Please try submitting the form again.");
      return;
    }
    
    setLoadingAction("create");
    try {
      // Update inquiry to mark intent
      const { error: updateError } = await supabase
        .from("venue_inquiries")
        .update({ intent: "create_now", status: "converted" })
        .eq("id", inquiryId);

      if (updateError) {
        console.error("Error updating inquiry:", updateError);
      }

      // Notify Pulse admins (non-blocking)
      notifyPulseAdmins(inquiryId, "create_now");

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is logged in - redirect to create venue with prefill
        navigate(`/venue/create-fast?inquiry=${inquiryId}`);
      } else {
        // User needs to sign up/login first
        const redirectUrl = `/venue/create-fast?inquiry=${inquiryId}`;
        navigate(`/auth?redirect=${encodeURIComponent(redirectUrl)}`);
      }
    } catch (error) {
      console.error("Error processing create now:", error);
      toast.error("Something went wrong. Please try again.");
      setLoadingAction(null);
    }
  };

  const handleRequestInfo = async () => {
    if (!inquiryId) return;
    
    setLoadingAction("info");
    try {
      // Update inquiry status
      await supabase
        .from("venue_inquiries")
        .update({ intent: "info_request", status: "info_requested" })
        .eq("id", inquiryId);

      // Notify Pulse admins
      await notifyPulseAdmins(inquiryId, "info_request");

      // Show thank you state
      setShowThankYou(true);
      toast.success("We'll be in touch soon!");
    } catch (error) {
      console.error("Error processing info request:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoadingAction(null);
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
    // Show thank you screen if info was requested
    if (showThankYou) {
      return (
        <ThankYouStep
          email={formData.email}
          venueName={formData.venueName}
        />
      );
    }

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
        return (
          <ConfirmationStep
            dynamicMessage={getDynamicMessage()}
            onCreateNow={handleCreateNow}
            onRequestInfo={handleRequestInfo}
            isLoading={loadingAction !== null}
            loadingAction={loadingAction}
          />
        );
      default:
        return null;
    }
  };

  // Hide navigation on confirmation step and thank you screen
  const hideNavigation = currentStep.id === "confirmation" || showThankYou;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <VenueInterestProgress
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        onBack={goBack}
        canGoBack={currentStepIndex > 0 && currentStep.id !== "confirmation" && !showThankYou}
      />

      <div className="flex-1 px-4 py-6 pb-24 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <VenueInterestWizardCard key={showThankYou ? "thank-you" : currentStep.id} direction={direction}>
            {renderStep()}
          </VenueInterestWizardCard>
        </AnimatePresence>
      </div>

      {!hideNavigation && (
        <VenueInterestNavigation
          onContinue={handleContinue}
          onSkip={currentStep.isOptional ? handleSkip : undefined}
          isValid={isStepValid(currentStep.id)}
          isOptional={currentStep.isOptional}
          isLastStep={false}
          isContactStep={currentStep.id === "contact"}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
