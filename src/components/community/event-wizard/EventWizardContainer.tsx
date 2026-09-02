import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { CalendarDays, Check, Clock3, LayoutGrid, MapPin, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useGroupEvents } from '@/hooks/useGroupEvents';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  EventWizardFormData,
  EVENT_FORMAT_LABELS,
  EVENT_WIZARD_STEPS,
  INITIAL_EVENT_WIZARD_DATA,
  encodeRecurringRule,
  generateOccurrenceStarts,
  generateDefaultEventTitle,
  suggestedPlayersPerCourt,
  type VenueEventCourt,
} from './types';
import { EventWizardProgress } from './EventWizardProgress';
import { EventWizardNav } from './EventWizardNav';
import { EventWizardCard } from './EventWizardCard';
import { EventTypeStep } from './steps/EventTypeStep';
import { EventNameStep } from './steps/EventNameStep';
import { EventDateTimeStep } from './steps/EventDateTimeStep';
import { EventDetailsStep } from './steps/EventDetailsStep';
import { EventReviewStep } from './steps/EventReviewStep';

interface EventWizardContainerProps {
  groupId: string;
  onClose: () => void;
  onSuccess: () => void;
  venue?: {
    id: string;
    name: string;
    courts: VenueEventCourt[];
    initialDate?: Date | null;
    initialStart?: Date | null;
    initialEnd?: Date | null;
    initialCourtIds?: string[];
  };
}

function timeValue(date: Date | null | undefined): string {
  return date ? format(date, 'HH:mm') : '';
}

export function EventWizardContainer({ groupId, onClose, onSuccess, venue }: EventWizardContainerProps) {
  const { createEvent } = useGroupEvents(groupId);
  const venueMode = !!venue;
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [capacityManuallySet, setCapacityManuallySet] = useState(false);

  const [formData, setFormData] = useState<EventWizardFormData>(() => ({
    ...INITIAL_EVENT_WIZARD_DATA,
    location: venue?.name ?? '',
    date: venue?.initialStart
      ? format(venue.initialStart, 'yyyy-MM-dd')
      : venue?.initialDate
        ? format(venue.initialDate, 'yyyy-MM-dd')
        : '',
    startTime: timeValue(venue?.initialStart),
    endTime: timeValue(venue?.initialEnd),
    selectedCourtIds: venue?.initialCourtIds ?? [],
  }));

  const occurrenceWindows = useMemo(() => {
    if (!formData.date || !formData.startTime || !formData.endTime) return [];
    const firstStart = new Date(`${formData.date}T${formData.startTime}`);
    const firstEnd = new Date(`${formData.date}T${formData.endTime}`);
    if (Number.isNaN(firstStart.getTime()) || Number.isNaN(firstEnd.getTime()) || firstEnd <= firstStart) {
      return [];
    }
    const duration = firstEnd.getTime() - firstStart.getTime();
    return generateOccurrenceStarts(
      firstStart,
      formData.recurringFrequency,
      formData.recurringCount,
    ).map((start) => ({ start, end: new Date(start.getTime() + duration) }));
  }, [
    formData.date,
    formData.startTime,
    formData.endTime,
    formData.recurringFrequency,
    formData.recurringCount,
  ]);

  const conflictQuery = useQuery({
    queryKey: [
      'venue-event-conflicts',
      venue?.id,
      occurrenceWindows[0]?.start.toISOString(),
      occurrenceWindows[occurrenceWindows.length - 1]?.end.toISOString(),
      formData.recurringFrequency,
      formData.recurringCount,
    ],
    enabled: venueMode && occurrenceWindows.length > 0,
    queryFn: async () => {
      const first = occurrenceWindows[0];
      const last = occurrenceWindows[occurrenceWindows.length - 1];
      const { data, error } = await supabase
        .from('group_events')
        .select('venue_court_id, start_time, end_time')
        .eq('venue_id', venue!.id)
        .not('venue_court_id', 'is', null)
        .lt('start_time', last.end.toISOString())
        .gt('end_time', first.start.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const busyCourtIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of conflictQuery.data ?? []) {
      if (!session.venue_court_id || !session.end_time) continue;
      const sessionStart = new Date(session.start_time);
      const sessionEnd = new Date(session.end_time);
      if (occurrenceWindows.some(({ start, end }) => start < sessionEnd && sessionStart < end)) {
        ids.add(session.venue_court_id);
      }
    }
    return ids;
  }, [conflictQuery.data, occurrenceWindows]);

  const step = EVENT_WIZARD_STEPS[currentStep];
  const isLastStep = currentStep === EVENT_WIZARD_STEPS.length - 1;

  const isStepValid = (): boolean => {
    switch (step.id) {
      case 'type':
        return formData.eventType !== null;
      case 'name':
        return formData.title.trim().length > 0;
      case 'datetime':
        if (!formData.date || !formData.startTime) return false;
        if (!venueMode) return true;
        return occurrenceWindows.length > 0;
      case 'details':
        if (!venueMode) return true;
        return (
          formData.selectedCourtIds.length > 0 &&
          !formData.selectedCourtIds.some((id) => busyCourtIds.has(id)) &&
          (formData.skillLevelMin == null ||
            formData.skillLevelMax == null ||
            formData.skillLevelMin <= formData.skillLevelMax)
        );
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < EVENT_WIZARD_STEPS.length - 1) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const goToStep = (nextStep: number) => {
    if (nextStep > currentStep || nextStep < 0) return;
    setDirection(nextStep < currentStep ? -1 : 1);
    setCurrentStep(nextStep);
  };

  const handleContinue = async () => {
    if (isLastStep) {
      await handleCreate();
    } else {
      goNext();
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      let endDateTime: Date | undefined;
      if (formData.endTime) {
        endDateTime = new Date(`${formData.date}T${formData.endTime}`);
      }

      // Generate occurrences for the series. generateOccurrenceStarts
      // returns [firstStart] for 'none', so we always slice the first
      // element off — that's the start_time on the base row — and pass
      // the rest as additional_starts to useGroupEvents.createEvent.
      const occurrences = generateOccurrenceStarts(
        startDateTime,
        formData.recurringFrequency,
        formData.recurringCount,
      );
      const additionalStarts = occurrences.slice(1).map((d) => d.toISOString());
      const recurringRule = encodeRecurringRule(
        formData.recurringFrequency,
        formData.recurringCount,
      );

      await createEvent({
        title: formData.title,
        description: formData.description || undefined,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString(),
        custom_location: formData.location || undefined,
        location_type: venueMode ? 'venue' : formData.location ? 'custom' : undefined,
        venue_id: venue?.id,
        venue_court_ids: venueMode ? formData.selectedCourtIds : undefined,
        capacity: formData.capacity || undefined,
        skill_level_min: formData.skillLevelMin ?? undefined,
        skill_level_max: formData.skillLevelMax ?? undefined,
        rotation_style: formData.rotationStyle ?? undefined,
        event_format: formData.eventType ?? 'open_play',
        // Waitlist only means anything with a capacity ceiling.
        waitlist_enabled: formData.capacity ? formData.waitlistEnabled : false,
        waitlist_limit:
          formData.capacity && formData.waitlistEnabled
            ? formData.waitlistLimit ?? undefined
            : undefined,
        rr_courts: formData.eventType === 'round_robin' ? formData.rrCourts ?? undefined : undefined,
        rr_games_per_player:
          formData.eventType === 'round_robin' ? formData.rrGamesPerPlayer ?? undefined : undefined,
        ...(recurringRule
          ? { recurring_rule: recurringRule, additional_starts: additionalStarts }
          : {}),
      });

      onSuccess();
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step.id) {
      case 'type':
        return (
          <EventTypeStep
            value={formData.eventType}
            venueMode={venueMode}
            onChange={(type) => {
              setFormData((prev) => ({
                ...prev,
                eventType: type,
                // Prefill a sensible title so the next step is one tap.
                title: prev.title || generateDefaultEventTitle(type),
                rotationStyle:
                  type === 'clinic'
                    ? 'coach_led'
                    : type === 'round_robin'
                      ? 'organized_games'
                      : type === 'open_play'
                        ? 'paddle_stack'
                        : prev.rotationStyle,
                rrCourts:
                  type === 'round_robin' && prev.selectedCourtIds.length > 0
                    ? prev.selectedCourtIds.length
                    : prev.rrCourts,
                capacity:
                  venueMode && !capacityManuallySet && prev.selectedCourtIds.length > 0
                    ? prev.selectedCourtIds.length * suggestedPlayersPerCourt(type)
                    : prev.capacity,
              }));
              // Auto-advance after selection
              setTimeout(() => goNext(), 150);
            }}
          />
        );
      case 'name':
        return (
          <EventNameStep
            title={formData.title}
            description={formData.description}
            eventType={formData.eventType}
            venueMode={venueMode}
            onTitleChange={(title) => setFormData((prev) => ({ ...prev, title }))}
            onDescriptionChange={(description) => setFormData((prev) => ({ ...prev, description }))}
          />
        );
      case 'datetime':
        return (
          <EventDateTimeStep
            date={formData.date}
            startTime={formData.startTime}
            endTime={formData.endTime}
            recurringFrequency={formData.recurringFrequency}
            recurringCount={formData.recurringCount}
            venueMode={venueMode}
            onDateChange={(date) => setFormData((prev) => ({ ...prev, date }))}
            onStartTimeChange={(startTime) => setFormData((prev) => ({ ...prev, startTime }))}
            onEndTimeChange={(endTime) => setFormData((prev) => ({ ...prev, endTime }))}
            onRecurringFrequencyChange={(recurringFrequency) =>
              setFormData((prev) => ({ ...prev, recurringFrequency }))
            }
            onRecurringCountChange={(recurringCount) =>
              setFormData((prev) => ({ ...prev, recurringCount }))
            }
          />
        );
      case 'details':
        return (
          <EventDetailsStep
            eventType={formData.eventType}
            location={formData.location}
            capacity={formData.capacity}
            waitlistEnabled={formData.waitlistEnabled}
            waitlistLimit={formData.waitlistLimit}
            rrCourts={formData.rrCourts}
            rrGamesPerPlayer={formData.rrGamesPerPlayer}
            venueMode={venueMode}
            venueName={venue?.name}
            courts={venue?.courts}
            selectedCourtIds={formData.selectedCourtIds}
            busyCourtIds={busyCourtIds}
            courtConflictsPending={conflictQuery.isFetching}
            skillLevelMin={formData.skillLevelMin}
            skillLevelMax={formData.skillLevelMax}
            rotationStyle={formData.rotationStyle}
            onLocationChange={(location) => setFormData((prev) => ({ ...prev, location }))}
            onCapacityChange={(capacity) => {
              setCapacityManuallySet(true);
              setFormData((prev) => ({ ...prev, capacity }));
            }}
            onWaitlistEnabledChange={(waitlistEnabled) =>
              setFormData((prev) => ({ ...prev, waitlistEnabled }))
            }
            onWaitlistLimitChange={(waitlistLimit) =>
              setFormData((prev) => ({ ...prev, waitlistLimit }))
            }
            onRrCourtsChange={(rrCourts) => setFormData((prev) => ({ ...prev, rrCourts }))}
            onRrGamesChange={(rrGamesPerPlayer) =>
              setFormData((prev) => ({ ...prev, rrGamesPerPlayer }))
            }
            onSelectedCourtsChange={(selectedCourtIds) =>
              setFormData((prev) => ({
                ...prev,
                selectedCourtIds,
                rrCourts: prev.eventType === 'round_robin' ? selectedCourtIds.length : prev.rrCourts,
                capacity: capacityManuallySet
                  ? prev.capacity
                  : selectedCourtIds.length > 0
                    ? selectedCourtIds.length * suggestedPlayersPerCourt(prev.eventType)
                    : null,
              }))
            }
            onSkillLevelMinChange={(skillLevelMin) =>
              setFormData((prev) => ({ ...prev, skillLevelMin }))
            }
            onSkillLevelMaxChange={(skillLevelMax) =>
              setFormData((prev) => ({ ...prev, skillLevelMax }))
            }
            onRotationStyleChange={(rotationStyle) =>
              setFormData((prev) => ({ ...prev, rotationStyle }))
            }
          />
        );
      case 'review':
        return <EventReviewStep formData={formData} venueName={venue?.name} courts={venue?.courts} />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn(
      'relative overflow-hidden border-border/70 p-4 shadow-[0_18px_50px_-30px_hsl(var(--foreground)/0.4)]',
      venueMode && 'rounded-none border-0 bg-transparent p-0 shadow-none',
    )}>
      <div className={cn(venueMode && 'sm:grid sm:max-h-[92dvh] sm:grid-cols-[220px_minmax(0,1fr)]')}>
        {venueMode && venue && (
          <VenueWizardSidebar
            venueName={venue.name}
            currentStep={currentStep}
            formData={formData}
            onStepChange={goToStep}
          />
        )}

        <div className={cn(venueMode && 'max-h-[96dvh] min-w-0 overflow-y-auto overscroll-contain p-4 sm:flex sm:min-h-[620px] sm:max-h-[92dvh] sm:flex-col')}>
          <EventWizardProgress
            currentStep={currentStep}
            onBack={goBack}
            onClose={onClose}
            canGoBack={currentStep > 0}
            venueMode={venueMode}
          />

          <div className="overflow-hidden sm:flex-1">
            <AnimatePresence mode="wait" custom={direction}>
              <EventWizardCard key={step.id} direction={direction}>
                {renderStep()}
              </EventWizardCard>
            </AnimatePresence>
          </div>

          {/* Don't show nav on type step since it auto-advances */}
          {step.id !== 'type' && (
            <EventWizardNav
              onContinue={handleContinue}
              onSkip={step.isOptional && !venueMode ? goNext : undefined}
              isValid={isStepValid()}
              isLastStep={isLastStep}
              isLoading={isLoading}
              showSkip={step.isOptional && !venueMode}
              finalLabel={venueMode ? 'Publish Program' : 'Create Event'}
              sticky={venueMode}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function VenueWizardSidebar({
  venueName,
  currentStep,
  formData,
  onStepChange,
}: {
  venueName: string;
  currentStep: number;
  formData: EventWizardFormData;
  onStepChange: (step: number) => void;
}) {
  const formatLabel = formData.eventType ? EVENT_FORMAT_LABELS[formData.eventType] : 'Choose a format';
  const scheduleStart = formData.date
    ? new Date(`${formData.date}T${formData.startTime || '12:00'}`)
    : null;
  const scheduleLabel = scheduleStart
    ? `${format(scheduleStart, 'MMM d')}${formData.startTime ? ` · ${format(scheduleStart, 'h:mm a')}` : ''}`
    : 'Date and time pending';

  return (
    <aside className="relative hidden overflow-hidden bg-[#17191d] text-white sm:flex sm:min-h-[620px] sm:flex-col">
      <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(115deg,transparent_0%,transparent_48%,white_49%,white_50%,transparent_51%)] [background-size:28px_28px]" />
      <div className="relative p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-primary">
          <CalendarDays className="h-[18px] w-[18px]" />
        </span>
        <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">Program builder</p>
        <h2 className="mt-1 text-lg font-extrabold leading-tight tracking-tight">Build a session players can trust.</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-white/55">Court inventory, registration, and the player-facing listing stay in sync.</p>
      </div>

      <nav className="relative px-3" aria-label="Program creation steps">
        {EVENT_WIZARD_STEPS.map((wizardStep, index) => {
          const active = index === currentStep;
          const complete = index < currentStep;
          return (
            <button
              key={wizardStep.id}
              type="button"
              disabled={index > currentStep}
              onClick={() => onStepChange(index)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors',
                active && 'bg-white/10 text-white',
                complete && 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                index > currentStep && 'cursor-default text-white/30',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] tabular-nums',
                  active && 'border-primary bg-primary text-primary-foreground',
                  complete && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
                )}
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              {wizardStep.label}
            </button>
          );
        })}
      </nav>

      <div className="relative mt-auto border-t border-white/10 p-4">
        <p className="mb-2.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
          <MapPin className="h-3 w-3" /> {venueName}
        </p>
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-[11px]">
          <SidebarSummary icon={CalendarDays} value={formatLabel} />
          <SidebarSummary icon={Clock3} value={scheduleLabel} />
          <SidebarSummary
            icon={LayoutGrid}
            value={formData.selectedCourtIds.length ? `${formData.selectedCourtIds.length} courts selected` : 'Courts pending'}
          />
          <SidebarSummary
            icon={Users}
            value={formData.capacity ? `${formData.capacity} player capacity` : 'Capacity pending'}
          />
        </div>
      </div>
    </aside>
  );
}

function SidebarSummary({ icon: Icon, value }: { icon: typeof CalendarDays; value: string }) {
  return (
    <div className="flex items-center gap-2 text-white/65">
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/35" />
      <span className="truncate">{value}</span>
    </div>
  );
}
