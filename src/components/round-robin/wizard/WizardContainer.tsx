import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WizardProgress } from "./WizardProgress";
import { WizardCard } from "./WizardCard";
import { WizardNavigation } from "./WizardNavigation";
import { useWizardSteps, WizardFormData, generateDefaultEventName, calculateScheduleMetrics } from "./hooks/useWizardSteps";
import { EventModeStep } from "./steps/EventModeStep";
import { EventNameStep } from "./steps/EventNameStep";
import { LocationStep } from "./steps/LocationStep";
import { FormatStep } from "./steps/FormatStep";
import { PlayersStep } from "./steps/PlayersStep";
import { CourtsStep } from "./steps/CourtsStep";
import { GamesStep } from "./steps/GamesStep";
import { DateTimeStep } from "./steps/DateTimeStep";
import { RatingsStep } from "./steps/RatingsStep";
import { NotesStep } from "./steps/NotesStep";
import { ReviewStep } from "./steps/ReviewStep";

interface Court {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
}

export function WizardContainer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const [formData, setFormData] = useState<WizardFormData>({
    eventMode: "immediate",
    eventName: "",
    locationId: "",
    format: "open",
    selectedPlayers: [],
    playerCount: 8,
    playerInputMethod: null,
    courtCount: 2,
    gamesPerPlayer: 3,
    eventDate: "",
    startTime: "",
    registrationDeadline: "",
    ratingEligible: true,
    ratingType: "league",
    notes: "",
    isPublished: false,
    maxPlayers: 20,
  });

  const { steps, totalSteps, isStepValid } = useWizardSteps(formData);
  const currentStep = steps[currentStepIndex];
  const isValid = isStepValid(currentStep.id);
  const isLastStep = currentStepIndex === totalSteps - 1;

  useEffect(() => {
    const fetchCourts = async () => {
      const { data } = await supabase.from("courts").select("*").order("name");
      if (data) setCourts(data);
    };
    fetchCourts();
  }, []);

  const updateFormData = <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
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

  const goToStep = (index: number) => {
    setDirection(index > currentStepIndex ? 1 : -1);
    setCurrentStepIndex(index);
  };

  const handleContinue = async () => {
    // Auto-fill event name if empty
    if (currentStep.id === "name" && !formData.eventName.trim()) {
      updateFormData("eventName", generateDefaultEventName());
    }

    if (isLastStep) {
      await handleCreate();
    } else {
      goNext();
    }
  };

  const handleSkip = () => {
    goNext();
  };

  const handleCreate = async () => {
    const name = formData.eventName.trim() || generateDefaultEventName();
    
    if (!name) {
      toast.error("Event name is required");
      return;
    }

    const playerCount = formData.eventMode === "immediate"
      ? (formData.selectedPlayers.length || formData.playerCount)
      : formData.maxPlayers;

    if (formData.eventMode === "immediate" && playerCount < 4) {
      toast.error("At least 4 players are required");
      return;
    }

    if (formData.eventMode === "open_registration") {
      if (!formData.eventDate || !formData.registrationDeadline) {
        toast.error("Event date and registration deadline are required");
        return;
      }
      if (new Date(formData.registrationDeadline) >= new Date(formData.eventDate)) {
        toast.error("Registration deadline must be before event date");
        return;
      }
    }

    // Validate format requirements for immediate mode with specific players
    if (formData.eventMode === "immediate" && formData.selectedPlayers.length > 0) {
      const males = formData.selectedPlayers.filter((p) => p.gender === "male").length;
      const females = formData.selectedPlayers.filter((p) => p.gender === "female").length;

      if (formData.format === "mixed" && (males < 2 || females < 2)) {
        toast.error("Mixed format requires at least 2 male and 2 female players");
        return;
      }
      if (formData.format === "male" && males < 4) {
        toast.error("Men's format requires at least 4 male players");
        return;
      }
      if (formData.format === "female" && females < 4) {
        toast.error("Women's format requires at least 4 female players");
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const metrics = calculateScheduleMetrics(playerCount, formData.courtCount, formData.gamesPerPlayer);

      const { data: event, error: eventError } = await supabase
        .from("round_robin_events")
        .insert({
          name: name,
          location: formData.locationId && formData.locationId !== "none" ? formData.locationId : null,
          notes: formData.notes.trim() || null,
          organizer_id: user.id,
          num_courts: formData.courtCount,
          games_per_player: formData.gamesPerPlayer,
          rating_eligible: formData.ratingEligible,
          rating_type: formData.ratingType,
          format: formData.format,
          registration_mode: formData.eventMode,
          num_rounds: formData.eventMode === "immediate" 
            ? metrics.rounds 
            : calculateScheduleMetrics(formData.maxPlayers, formData.courtCount, formData.gamesPerPlayer).rounds,
          date: formData.eventMode === "immediate"
            ? new Date().toISOString().split("T")[0]
            : new Date(formData.eventDate).toISOString().split("T")[0],
          registration_deadline: formData.eventMode === "open_registration" 
            ? new Date(formData.registrationDeadline).toISOString() 
            : null,
          max_players: formData.eventMode === "open_registration" ? formData.maxPlayers : null,
          is_published: formData.eventMode === "open_registration" ? formData.isPublished : null,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Add players for immediate mode with selected players
      if (formData.eventMode === "immediate" && formData.selectedPlayers.length > 0) {
        const playerInserts = formData.selectedPlayers.map((p) => ({
          event_id: event.id,
          player_id: p.id,
          registration_status: "confirmed",
        }));

        const { error: playersError } = await supabase
          .from("round_robin_players")
          .insert(playerInserts);

        if (playersError) throw playersError;
      }

      const successMessage = formData.eventMode === "immediate"
        ? "Event created successfully!"
        : formData.isPublished
          ? "Event created and published!"
          : "Event created in draft mode.";

      toast.success(successMessage);
      navigate(`/round-robin/${event.id}`);
    } catch (error: unknown) {
      toast.error("Failed to create event");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case "mode":
        return (
          <EventModeStep
            value={formData.eventMode}
            onChange={(v) => {
              updateFormData("eventMode", v);
              setTimeout(() => goNext(), 150);
            }}
          />
        );
      case "name":
        return (
          <EventNameStep
            value={formData.eventName}
            onChange={(v) => updateFormData("eventName", v)}
          />
        );
      case "location":
        return (
          <LocationStep
            value={formData.locationId}
            onChange={(v) => updateFormData("locationId", v)}
          />
        );
      case "format":
        return (
          <FormatStep
            value={formData.format}
            onChange={(v) => {
              updateFormData("format", v);
              setTimeout(() => goNext(), 150);
            }}
          />
        );
      case "players":
        return (
          <PlayersStep
            eventMode={formData.eventMode}
            selectedPlayers={formData.selectedPlayers}
            onPlayersChange={(v) => updateFormData("selectedPlayers", v)}
            playerCount={formData.playerCount}
            onPlayerCountChange={(v) => updateFormData("playerCount", v)}
            inputMethod={formData.playerInputMethod}
            onInputMethodChange={(v) => updateFormData("playerInputMethod", v)}
            format={formData.format}
            maxPlayers={formData.maxPlayers}
            onMaxPlayersChange={(v) => updateFormData("maxPlayers", v)}
          />
        );
      case "courts":
        return (
          <CourtsStep
            value={formData.courtCount}
            onChange={(v) => updateFormData("courtCount", v)}
          />
        );
      case "games":
        return (
          <GamesStep
            value={formData.gamesPerPlayer}
            onChange={(v) => updateFormData("gamesPerPlayer", v)}
          />
        );
      case "datetime":
        return (
          <DateTimeStep
            eventMode={formData.eventMode}
            eventDate={formData.eventDate}
            onEventDateChange={(v) => updateFormData("eventDate", v)}
            startTime={formData.startTime}
            onStartTimeChange={(v) => updateFormData("startTime", v)}
            registrationDeadline={formData.registrationDeadline}
            onRegistrationDeadlineChange={(v) => updateFormData("registrationDeadline", v)}
          />
        );
      case "ratings":
        return (
          <RatingsStep
            ratingEligible={formData.ratingEligible}
            onRatingEligibleChange={(v) => updateFormData("ratingEligible", v)}
            ratingType={formData.ratingType}
            onRatingTypeChange={(v) => updateFormData("ratingType", v)}
          />
        );
      case "notes":
        return (
          <NotesStep
            value={formData.notes}
            onChange={(v) => updateFormData("notes", v)}
          />
        );
      case "review":
        return (
          <ReviewStep
            formData={formData}
            onEdit={goToStep}
            courts={courts}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <WizardProgress
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        onBack={goBack}
        canGoBack={currentStepIndex > 0}
      />

      <main className="flex-1 px-4 py-6 pb-24 overflow-hidden">
        <div className="max-w-md mx-auto h-full">
          <AnimatePresence mode="wait" custom={direction}>
            <WizardCard key={currentStep.id} direction={direction}>
              {renderStep()}
            </WizardCard>
          </AnimatePresence>
        </div>
      </main>

      {/* Hide nav on auto-advance steps */}
      {currentStep.id !== 'mode' && currentStep.id !== 'format' && (
        <WizardNavigation
          onContinue={handleContinue}
          onSkip={currentStep.isOptional ? handleSkip : undefined}
          isValid={isValid}
          isOptional={currentStep.isOptional}
          isLastStep={isLastStep}
          isLoading={loading}
        />
      )}
    </div>
  );
}
