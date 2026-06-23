import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WizardProgress } from "./WizardProgress";
import { WizardCard } from "./WizardCard";
import { WizardNavigation } from "./WizardNavigation";
import { useWizardSteps, WizardFormData, generateDefaultEventName, calculateScheduleMetrics } from "./hooks/useWizardSteps";
import { EventModeStep } from "./steps/EventModeStep";
import { FormatStep } from "./steps/FormatStep";
import { DetailsStep } from "./steps/DetailsStep";
import { PlayersStep } from "./steps/PlayersStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import { DateTimeStep } from "./steps/DateTimeStep";
import { RatingsStep } from "./steps/RatingsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { GroupShareStep } from "./steps/GroupShareStep";

interface Court {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
}

export function WizardContainer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Optional ?venueId=… — when the wizard is launched from a venue console
  // ("Create Round Robin" button in VenueRoundRobins), this links the new
  // event to that venue so it shows up in the venue's RR list. Falls back
  // to a free-standing player-organized event if absent.
  const venueId = searchParams.get("venueId");
  // Optional ?groupId=… — when launched from a group page, pre-select that
  // group and default to "shared_group" visibility.
  const presetGroupId = searchParams.get("groupId");
  const [loading, setLoading] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const [formData, setFormData] = useState<WizardFormData>({
    eventMode: "immediate",
    eventName: "",
    locationId: "",
    locationLabel: "",
    cityLabel: "",
    cityPlaceId: "",
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
    isInviteOnly: false,
    groupVisibility: presetGroupId ? "shared_group" : "personal",
    groupId: presetGroupId,
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
          // Compose the human-readable location label shown on match cards:
          // "<Location Name> · <City, ST>" when both exist, otherwise
          // whichever the host filled in. The court UUID dropdown was
          // removed from this wizard, so we no longer look anything up
          // from the courts table here.
          location:
            [formData.locationLabel.trim(), formData.cityLabel.trim()]
              .filter(Boolean)
              .join(" · ") || null,

          notes: formData.notes.trim() || null,
          organizer_id: user.id,
          // Link to a venue when the wizard was launched from the venue console
          // (via ?venueId=…). Null for player-organized RRs — keeps existing
          // free-standing flow unchanged.
          venue_id: venueId || null,
          num_courts: formData.courtCount,
          games_per_player: formData.gamesPerPlayer,
          rating_eligible: formData.ratingEligible,
          rating_type: formData.ratingType,
          format: formData.format,
          // Discriminator: 'immediate' / 'open_registration' / 'invite_only'.
          // When isInviteOnly is checked alongside open_registration mode,
          // we store 'invite_only' so the DB trigger generates a unique
          // invite_code AND so the discovery feed query (which filters on
          // registration_mode='open_registration') hides this event.
          registration_mode:
            formData.eventMode === "open_registration" && formData.isInviteOnly
              ? "invite_only"
              : formData.eventMode,
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
          // Invite-only events are never published to the public Available
          // feed — surface only through code entry.
          is_published:
            formData.eventMode === "open_registration"
              ? (formData.isInviteOnly ? false : formData.isPublished)
              : null,
          group_id: formData.groupVisibility !== "personal" ? formData.groupId : null,
          group_visibility: formData.groupVisibility,
        } as never)
        .select()
        .single();

      if (eventError) throw eventError;

      // Add players for immediate mode with selected players (real + guests)
      if (formData.eventMode === "immediate" && formData.selectedPlayers.length > 0) {
        const playerInserts = formData.selectedPlayers.map((p) => ({
          event_id: event.id,
          player_id: p.isGuest ? null : p.id,
          guest_name: p.isGuest ? (p.display_name || p.full_name) : null,
          registration_status: "confirmed",
        }));

        const { error: playersError } = await supabase
          .from("round_robin_players")
          .insert(playerInserts as never);

        if (playersError) throw playersError;
      }
      // If shared with a group, post it to the group's feed (unpinned) and
      // add it to the group's calendar so it shows up in one feed slot plus
      // the schedule — no rail duplication.
      if (formData.groupVisibility === "shared_group" && formData.groupId) {
        // Build the actual event start/end for both the post copy and the
        // calendar entry. Immediate mode starts now; scheduled modes use the
        // user-picked date + time.
        let eventStart: Date;
        if (formData.eventMode === "immediate") {
          eventStart = new Date();
        } else {
          const time = formData.startTime || "10:00";
          eventStart = new Date(`${new Date(formData.eventDate).toISOString().split("T")[0]}T${time}`);
        }
        const eventEnd = new Date(eventStart.getTime() + 2 * 60 * 60 * 1000); // default 2h block

        const dateLabel = eventStart.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeLabel = eventStart.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });

        const { error: postError } = await supabase.from("group_posts").insert({
          group_id: formData.groupId,
          user_id: user.id,
          type: "round_robin",
          title: name,
          content: formData.notes.trim() || `Round Robin on ${dateLabel} at ${timeLabel}`,
          pinned: false,
          round_robin_event_id: event.id,
        } as never);
        if (postError) console.error("Failed to post RR to group:", postError);

        const { error: calError } = await supabase.from("group_events").insert({
          group_id: formData.groupId,
          created_by: user.id,
          title: name,
          description: formData.notes.trim() || `Round Robin event`,
          start_time: eventStart.toISOString(),
          end_time: eventEnd.toISOString(),
          location_type: "custom",
          venue_id: null,
          custom_location: courts.find((c) => c.id === formData.locationId)?.name || null,
          capacity: formData.eventMode === "open_registration" ? formData.maxPlayers : null,
        } as never);
        if (calError) console.error("Failed to add RR to group calendar:", calError);
      }


      // Surface the auto-generated invite code prominently for invite-only
      // events so the host can immediately share it. For other modes,
      // keep the existing short toast.
      if (formData.eventMode === "open_registration" && formData.isInviteOnly && event.invite_code) {
        toast.success(`Invite code: ${event.invite_code}`, {
          description: "Share this code so players can join. The full code is also on the event page.",
          duration: 10000,
        });
      } else {
        const successMessage = formData.eventMode === "immediate"
          ? "Event created successfully!"
          : formData.isPublished
            ? "Event created and published!"
            : "Event created in draft mode.";
        toast.success(successMessage);
      }
      // Venue-context creates land on the venue console RR detail so staff
      // stay inside their console. Player-organized creates land on the
      // public detail page they would naturally share.
      if (venueId) {
        navigate(`/venue/round-robins/${event.id}`);
      } else {
        navigate(`/round-robin/${event.id}`);
      }
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
      case "details":
        return (
          <DetailsStep
            eventName={formData.eventName}
            onEventNameChange={(v) => updateFormData("eventName", v)}
            locationLabel={formData.locationLabel}
            onLocationLabelChange={(v) => updateFormData("locationLabel", v)}
            cityLabel={formData.cityLabel}
            cityPlaceId={formData.cityPlaceId}
            onCityChange={(label, placeId) => {
              updateFormData("cityLabel", label);
              updateFormData("cityPlaceId", placeId);
            }}
            notes={formData.notes}
            onNotesChange={(v) => updateFormData("notes", v)}
            eventMode={formData.eventMode}
            isInviteOnly={formData.isInviteOnly}
            onIsInviteOnlyChange={(v) => updateFormData("isInviteOnly", v)}
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
            groupId={formData.groupVisibility !== "personal" ? formData.groupId : null}
          />
        );
      case "schedule":
        // Combined Courts + Games — see ScheduleStep for rationale.
        return (
          <ScheduleStep
            courtCount={formData.courtCount}
            onCourtCountChange={(v) => updateFormData("courtCount", v)}
            gamesPerPlayer={formData.gamesPerPlayer}
            onGamesPerPlayerChange={(v) => updateFormData("gamesPerPlayer", v)}
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
      case "sharing":
        return (
          <GroupShareStep
            visibility={formData.groupVisibility}
            groupId={formData.groupId}
            onChange={(v, gid) => {
              updateFormData("groupVisibility", v);
              updateFormData("groupId", gid);
            }}
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
    <div className="min-h-screen bg-background">
      {/* PULSE-branded header — matches the Record Match wizard so both
          flows feel like one product. Step chrome lives in the body. */}
      <div className="sticky top-0 z-40 bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-[72px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/player/dashboard')}
            className="h-9 w-9 text-white hover:text-white hover:bg-white/10"
            aria-label="Cancel and return home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link
            to="/player/dashboard"
            className="text-secondary-foreground hover:opacity-90 transition-opacity"
          >
            <Logo className="h-[52px] sm:h-[65px] w-auto" />
          </Link>
          <div className="h-9 w-9" aria-hidden="true" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        <div className="mb-4">
          <h1 className="text-xl font-semibold leading-tight">Create Round Robin</h1>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            Set up your event in a few quick steps
          </p>
        </div>

        <WizardProgress
          currentStep={currentStepIndex}
          totalSteps={totalSteps}
          onBack={goBack}
          canGoBack={currentStepIndex > 0}
          stepLabel={currentStep.label}
        />

        <AnimatePresence mode="wait" custom={direction}>
          <WizardCard key={currentStep.id} direction={direction}>
            {renderStep()}
          </WizardCard>
        </AnimatePresence>
      </div>

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
