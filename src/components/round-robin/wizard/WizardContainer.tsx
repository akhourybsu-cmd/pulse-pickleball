import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PRESSABLE } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { WizardStepMenu } from "./WizardStepMenu";
import { WizardEventPreview } from "./WizardEventPreview";
import "./wizard.css";
import { WizardCard } from "./WizardCard";
import { WizardNavigation } from "./WizardNavigation";
import { useWizardSteps, WizardFormData, calculateScheduleMetrics } from "./hooks/useWizardSteps";
import { EventModeStep } from "./steps/EventModeStep";
import { FormatStep } from "./steps/FormatStep";
import { DetailsStep } from "./steps/DetailsStep";
import { PlayersStep } from "./steps/PlayersStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import { DateTimeStep } from "./steps/DateTimeStep";
import { RatingsStep } from "./steps/RatingsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { GroupShareStep } from "./steps/GroupShareStep";
import { rosterGenderIssue } from "@/lib/roundRobin/participantGender";

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
  // Optional ?groupId=… — when launched from a group page, pre-select that
  // group and default to "shared_group" visibility.
  const presetGroupId = searchParams.get("groupId");
  const [loading, setLoading] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [furthestStep, setFurthestStep] = useState(0);
  const [editingFromReview, setEditingFromReview] = useState(false);

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
    allowGuests: false,
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
    if (!loading && isValid && currentStepIndex < totalSteps - 1) {
      goToStep(currentStepIndex + 1);
    }
  };

  const goBack = () => {
    if (!loading && currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  const goToStep = (index: number) => {
    if (loading || index < 0 || index >= totalSteps) return;
    setDirection(index > currentStepIndex ? 1 : -1);
    setCurrentStepIndex(index);
    setFurthestStep((previous) => Math.max(previous, index));
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleContinue = async () => {
    if (loading || !isValid) return;
    if (isLastStep) {
      await handleCreate();
    } else {
      goNext();
    }
  };

  const handleSkip = () => {
    // Skipping an optional step (Ratings / Sharing) jumps past any further
    // optional steps straight to the next required step — which is Review —
    // so a host who wants the fast path saves real taps rather than landing
    // on the next skippable screen.
    let next = currentStepIndex + 1;
    while (next < totalSteps - 1 && steps[next].isOptional) {
      next++;
    }
    goToStep(next);
  };

  const handleCreate = async () => {
    // Review and step-menu edits can invalidate an earlier choice. Reuse
    // the existing validations before invoking the unchanged creation flow.
    const incomplete = steps.findIndex((step) => !isStepValid(step.id));
    if (incomplete >= 0) {
      setEditingFromReview(true);
      goToStep(incomplete);
      toast.error(`Complete ${steps[incomplete].label.toLowerCase()} before creating your event`, { position: "top-center" });
      return;
    }
    const name = formData.eventName.trim();
    const locationLabel = formData.locationLabel.trim();

    if (!name) {
      toast.error("Event name is required");
      return;
    }
    if (!locationLabel) {
      toast.error("Location name is required");
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
      const genderIssue = rosterGenderIssue(
        formData.format,
        formData.selectedPlayers.map((player) => player.gender),
      );
      if (genderIssue) {
        toast.error(genderIssue);
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
          // Inert venue_id column (venue feature retired) — always null.
          venue_id: null,
          num_courts: formData.courtCount,
          games_per_player: formData.gamesPerPlayer,
          rating_eligible: formData.allowGuests ? false : formData.ratingEligible,
          rating_type: formData.ratingType,
          allow_guests: formData.allowGuests,
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

      // Add players for immediate mode with selected players (real + guests).
      // Guests come from PlayerPickerSheet as { id: <guest_player_id>, isGuest: true }
      // (the picker persists new guest names to the guest_players table before
      // returning them, so the id is always a real DB uuid we can FK to).
      if (formData.eventMode === "immediate" && formData.selectedPlayers.length > 0) {
        const playerInserts = formData.selectedPlayers.map((p) => ({
          event_id: event.id,
          player_id: p.isGuest ? null : p.id,
          guest_player_id: p.isGuest ? p.id : null,
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
      haptic("success");
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
            onChange={(v) => updateFormData("eventMode", v)}
          />
        );
      case "format":
        return (
          <FormatStep
            value={formData.format}
            onChange={(v) => updateFormData("format", v)}
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
            allowGuests={formData.allowGuests}
            onAllowGuestsChange={(v) => updateFormData("allowGuests", v)}
            onRatingEligibleChange={(v) => updateFormData("ratingEligible", v)}
          />
        );
      case "schedule":
        // Combined Courts + Games — see ScheduleStep for rationale.
        return (
          <ScheduleStep
            playerCount={
              formData.eventMode === "open_registration"
                ? formData.maxPlayers
                : formData.playerInputMethod === "add"
                  ? formData.selectedPlayers.length
                  : formData.playerCount
            }
            courtCount={formData.courtCount}
            onCourtCountChange={(v) => updateFormData("courtCount", v)}
            gamesPerPlayer={formData.gamesPerPlayer}
            onGamesPerPlayerChange={(v) => updateFormData("gamesPerPlayer", v)}
            format={formData.format}
            selectedPlayers={formData.selectedPlayers}
            rosterCompositionKnown={
              formData.eventMode === "immediate" && formData.playerInputMethod === "add"
            }
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
            allowGuests={formData.allowGuests}
            onAllowGuestsChange={(v) => updateFormData("allowGuests", v)}
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
            onEdit={(index) => { setEditingFromReview(true); goToStep(index); }}
            courts={courts}
          />
        );
      default:
        return null;
    }
  };

  const validationHints: Record<string, string> = {
    details: "Add an event name and location to continue.",
    players: "Choose your player setup and add at least 4 eligible players.",
    schedule: "Choose at least 1 court and 1 game per player.",
    datetime: formData.eventMode === "immediate" ? "Choose a start time to continue." : "Set a date, start time, and an earlier registration deadline.",
    sharing: "Choose a group, or select Just me / friends I add.",
  };

  return (
    <div className="rr-wizard">
      <header className="rr-wizard-header">
        <svg className="rr-header-pulse" viewBox="0 0 1200 18" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path className="rr-heartbeat" pathLength="1" d="M0 9h550l12-5 10 9 12-12 14 16 12-8h590" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="rr-header-inner">
          <div className="flex items-center">
            <Link to="/player/dashboard" aria-label="PULSE home"><Logo className="h-12 w-auto" /></Link>
            <span className="rr-header-label rr-eyebrow">Event studio</span>
          </div>
          <Button variant="ghost" disabled={loading} onClick={() => navigate('/player/dashboard')}
            className={cn("h-11 gap-2 text-secondary-foreground hover:bg-white/10 hover:text-white", PRESSABLE)}>
            <ArrowLeft className="h-4 w-4" /><span className="text-xs">Exit setup</span>
          </Button>
        </div>
      </header>
      <section className="rr-masthead" aria-labelledby="rr-creation-title">
        <div>
          <p className="rr-eyebrow text-primary">Round robin / Create an event</p>
          <h1 id="rr-creation-title">Set the stage. <span className="text-primary">Find your PULSE.</span></h1>
          <p>Bring your players together. We’ll take care of the rotation.</p>
        </div>
        <div className="rr-masthead-note"><Activity className="h-5 w-5 text-primary" /><span>Great games.<br />Thoughtfully organized.</span></div>
      </section>
      <div className="rr-layout">
        <WizardStepMenu steps={steps} current={currentStepIndex} furthest={furthestStep}
          isStepValid={isStepValid} disabled={loading}
          onSelect={(index) => { setEditingFromReview(false); goToStep(index); }} />
        <main className="rr-main" aria-label="Event setup">
          <div className="rr-main-topline">
            <p className="rr-eyebrow" aria-live="polite">Step {String(currentStepIndex + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")} <span className="ml-3 tracking-normal normal-case font-medium">{currentStep.label}</span></p>
            <span className="text-[11px]">{currentStep.isOptional ? "Optional · make it yours" : "Your event, your way"}</span>
          </div>
          <fieldset disabled={loading} className="min-w-0">
            <legend className="sr-only">{currentStep.label}</legend>
            <AnimatePresence mode="wait" custom={direction}>
              <WizardCard key={currentStep.id} direction={direction}>{renderStep()}</WizardCard>
            </AnimatePresence>
          </fieldset>
        </main>
        <WizardEventPreview formData={formData} />
      </div>
      <WizardNavigation onContinue={handleContinue} onBack={goBack} canGoBack={currentStepIndex > 0}
        onSkip={currentStep.isOptional && !editingFromReview ? handleSkip : undefined}
        onReturnToReview={editingFromReview && !isLastStep ? () => { setEditingFromReview(false); goToStep(totalSteps - 1); } : undefined}
        isValid={isValid} isOptional={currentStep.isOptional} isLastStep={isLastStep} isLoading={loading}
        nextLabel={steps[currentStepIndex + 1]?.label} hint={validationHints[currentStep.id]} />
    </div>
  );
}
