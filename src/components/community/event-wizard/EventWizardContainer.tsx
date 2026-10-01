import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { CalendarDays, Check, Clock3, LayoutGrid, MapPin, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useGroupEvents } from '@/hooks/useGroupEvents';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { canUseVenueCourtSelection } from '@/lib/venues/experience';
import { fetchProgramAvailability } from '@/lib/venues/programAvailability';
import { allocateAvailableCourts, clockMinutes, endAfterDuration, programWindows } from '@/lib/venues/programScheduling';
import { venueCalendarNow } from '@/lib/venues/timezone';
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
import { GroupEventWizardShell } from './GroupEventWizardShell';
import { GROUP_EVENT_STEPS, canVisitGroupEventStep, groupEventStepError } from './groupFlow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EventWizardContainerProps {
  groupId: string;
  onClose: () => void;
  onSuccess: () => void;
  onPendingChange?: (pending: boolean) => void;
  venue?: {
    id: string;
    name: string;
    timeZone?: string | null;
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

export function EventWizardContainer({ groupId, onClose, onSuccess, onPendingChange, venue }: EventWizardContainerProps) {
  const { createEvent } = useGroupEvents(groupId);
  const venueMode = !!venue;
  const [currentStep, setCurrentStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [capacityManuallySet, setCapacityManuallySet] = useState(false);
  const [courtCount, setCourtCount] = useState(venue?.initialCourtIds?.length ?? 0);

  const [formData, setFormData] = useState<EventWizardFormData>(() => ({
    ...INITIAL_EVENT_WIZARD_DATA,
    location: venue?.name ?? '',
    date: venue?.initialStart
      ? format(venueCalendarNow(venue.timeZone, venue.initialStart), 'yyyy-MM-dd')
      : venue?.initialDate
        ? format(venue.initialDate, 'yyyy-MM-dd')
        : '',
    startTime: timeValue(venue?.initialStart ? venueCalendarNow(venue.timeZone, venue.initialStart) : null),
    endTime: timeValue(venue?.initialEnd ? venueCalendarNow(venue.timeZone, venue.initialEnd) : null),
    selectedCourtIds: venue?.initialCourtIds ?? [],
  }));

  const occurrenceWindows = useMemo(() => {
    return programWindows(
      formData.date, formData.startTime, formData.endTime,
      formData.recurringFrequency,
      formData.recurringCount,
      venue?.timeZone,
    );
  }, [
    formData.date,
    formData.startTime,
    formData.endTime,
    formData.recurringFrequency,
    formData.recurringCount,
    venue?.timeZone,
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
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: () => fetchProgramAvailability(venue!.id, occurrenceWindows),
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

  const steps = venueMode ? EVENT_WIZARD_STEPS : GROUP_EVENT_STEPS;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const groupValidation = isLastStep
    ? GROUP_EVENT_STEPS.map(item => groupEventStepError(item.id, formData)).find(Boolean) ?? null
    : groupEventStepError(step.id, formData);
  const courtsConfirmed = formData.selectedCourtIds.length === courtCount
    && formData.selectedCourtIds.every(id => venue?.courts.some(c => c.id === id && c.is_active !== false))
    && canUseVenueCourtSelection(formData.selectedCourtIds, busyCourtIds, conflictQuery.isSuccess && !conflictQuery.isFetching);

  const selectCourts = (selectedCourtIds: string[]) => setFormData(prev => ({
    ...prev, selectedCourtIds,
    rrCourts: prev.eventType === 'round_robin' ? selectedCourtIds.length : prev.rrCourts,
    capacity: capacityManuallySet ? prev.capacity : selectedCourtIds.length ? selectedCourtIds.length * suggestedPlayersPerCourt(prev.eventType) : null,
  }));

  const isStepValid = (): boolean => {
    if (!venueMode) return !groupValidation;
    switch (step.id) {
      case 'type':
        return formData.eventType !== null;
      case 'name':
        return formData.title.trim().length > 0;
      case 'datetime':
        if (!formData.date || !formData.startTime) return false;
        return occurrenceWindows.length > 0;
      case 'details':
        return (
          courtsConfirmed &&
          (formData.skillLevelMin == null ||
            formData.skillLevelMax == null ||
            formData.skillLevelMin <= formData.skillLevelMax)
        );
      case 'review':
        return courtsConfirmed;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
      setFurthestStep(prev => Math.max(prev, currentStep + 1));
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const goToStep = (nextStep: number) => {
    if (isLoading || (venueMode ? nextStep > currentStep || nextStep < 0 : !canVisitGroupEventStep(nextStep, furthestStep, formData))) return;
    setDirection(nextStep < currentStep ? -1 : 1);
    setCurrentStep(nextStep);
  };

  const handleContinue = async () => {
    if (isLoading || !isStepValid()) return;
    if (isLastStep) {
      await handleCreate();
    } else if (!venueMode && canVisitGroupEventStep(steps.length - 1, furthestStep, formData)) {
      goToStep(steps.length - 1);
    } else {
      goNext();
    }
  };

  const handleCreate = async () => {
    if (isLoading || (venueMode ? !courtsConfirmed : !!groupValidation)) return;
    setIsLoading(true);
    onPendingChange?.(true);
    setCreateError(null);
    try {
      const startDateTime = venueMode ? occurrenceWindows[0].start : new Date(`${formData.date}T${formData.startTime}`);
      let endDateTime: Date | undefined;
      if (formData.endTime) {
        endDateTime = venueMode ? occurrenceWindows[0].end : new Date(`${formData.date}T${formData.endTime}`);
      }

      // Generate occurrences for the series. generateOccurrenceStarts
      // returns [firstStart] for 'none', so we always slice the first
      // element off — that's the start_time on the base row — and pass
      // the rest as additional_starts to useGroupEvents.createEvent.
      const occurrences = venueMode ? occurrenceWindows.map(window => window.start) : generateOccurrenceStarts(
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
        title: formData.title.trim(),
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
          ? { recurring_rule: recurringRule, additional_starts: additionalStarts,
            additional_ends: venueMode ? occurrenceWindows.slice(1).map(window => window.end.toISOString()) : undefined }
          : {}),
      });

      onSuccess();
    } catch (error) {
      setCreateError(getErrorMessage(error, `The ${venueMode ? 'program' : 'event'} could not be created. Your draft is still here; please try again.`));
    } finally {
      setIsLoading(false);
      onPendingChange?.(false);
    }
  };

  const renderStep = (stepId = step.id): React.ReactNode => {
    switch (stepId) {
      case 'basics':
        return <div className="space-y-5">{renderStep('type')}{renderStep('name')}</div>;
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
                title: !prev.title || prev.title === generateDefaultEventTitle(prev.eventType) ? generateDefaultEventTitle(type) : prev.title,
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
              // Group creation has an explicit Continue action. Venue selection
              // still advances immediately, without a delayed double-tap race.
              if (venueMode) goNext();
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
          <div className="space-y-5">
          <EventDateTimeStep
            date={formData.date}
            startTime={formData.startTime}
            endTime={formData.endTime}
            recurringFrequency={formData.recurringFrequency}
            recurringCount={formData.recurringCount}
            venueMode={venueMode}
            timeZone={venue?.timeZone}
            onDateChange={(date) => setFormData((prev) => ({ ...prev, date }))}
            onStartTimeChange={(startTime) => setFormData((prev) => ({ ...prev, startTime,
              endTime: venueMode && prev.endTime ? endAfterDuration(startTime, clockMinutes(prev.endTime) - clockMinutes(prev.startTime)) : prev.endTime,
            }))}
            onEndTimeChange={(endTime) => setFormData((prev) => ({ ...prev, endTime }))}
            onRecurringFrequencyChange={(recurringFrequency) =>
              setFormData((prev) => ({ ...prev, recurringFrequency }))
            }
            onRecurringCountChange={(recurringCount) =>
              setFormData((prev) => ({ ...prev, recurringCount }))
            }
          />
          {!venueMode && (
            <div className="space-y-1.5 border-t pt-4">
              <Label htmlFor="event-location">
                Where are you playing? <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="event-location" placeholder="Court, park, or meetup spot"
                value={formData.location}
                onChange={event => setFormData(prev => ({ ...prev, location: event.target.value }))} />
            </div>
          )}
          </div>
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
            hideLocation={!venueMode}
            venueName={venue?.name}
            courts={venue?.courts}
            selectedCourtIds={formData.selectedCourtIds}
            courtCount={courtCount}
            onCourtCountChange={(count) => {
              setCourtCount(count);
              selectCourts(allocateAvailableCourts(venue?.courts ?? [], busyCourtIds, count, formData.selectedCourtIds));
            }}
            busyCourtIds={busyCourtIds}
            courtConflictsPending={conflictQuery.isPending || conflictQuery.isFetching}
            courtConflictsError={conflictQuery.isError}
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
            onSelectedCourtsChange={(ids) => { setCourtCount(ids.length); selectCourts(ids); }}
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
        return <EventReviewStep formData={formData} venueName={venue?.name}
          courts={venue?.courts} timeZone={venue?.timeZone}
          onEdit={!venueMode ? (id) => goToStep(GROUP_EVENT_STEPS.findIndex(item => item.id === id)) : undefined} />;
      default:
        return null;
    }
  };

  if (!venueMode) {
    return (
      <GroupEventWizardShell
        currentStep={currentStep}
        canVisit={index => canVisitGroupEventStep(index, furthestStep, formData)}
        onStepChange={goToStep}
        onBack={goBack}
        onContinue={() => void handleContinue()}
        onClose={onClose}
        isLoading={isLoading}
        validationMessage={groupValidation}
        createError={createError}
        returningToReview={!isLastStep && canVisitGroupEventStep(steps.length - 1, furthestStep, formData)}
      >
        {renderStep()}
      </GroupEventWizardShell>
    );
  }

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
          {venueMode && ['details', 'review'].includes(step.id) && conflictQuery.isError && <div role="alert" className="my-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm"><p>We couldn’t confirm court availability. Your entries are unchanged; retry before continuing.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void conflictQuery.refetch()}>Retry availability</Button></div>}
          {venueMode && step.id === 'review' && !conflictQuery.isError && !courtsConfirmed && <p role="status" className="my-3 rounded-xl border p-3 text-sm">{conflictQuery.isFetching ? 'Checking the court schedule…' : 'Availability changed. Return to Details to select available courts before publishing.'}</p>}
          {createError && <p role="alert" className="my-3 rounded-xl border border-destructive/25 p-3 text-sm">{createError}</p>}
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
