import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useGroupEvents } from '@/hooks/useGroupEvents';
import { EventWizardFormData, EVENT_WIZARD_STEPS, encodeRecurringRule, generateOccurrenceStarts } from './types';
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
}

export function EventWizardContainer({ groupId, onClose, onSuccess }: EventWizardContainerProps) {
  const { createEvent } = useGroupEvents(groupId);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<EventWizardFormData>({
    eventType: null,
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    capacity: null,
    recurringFrequency: 'none',
    recurringCount: 4,
  });

  const step = EVENT_WIZARD_STEPS[currentStep];
  const isLastStep = currentStep === EVENT_WIZARD_STEPS.length - 1;

  const isStepValid = (): boolean => {
    switch (step.id) {
      case 'type':
        return formData.eventType !== null;
      case 'name':
        return formData.title.trim().length > 0;
      case 'datetime':
        return formData.date !== '' && formData.startTime !== '';
      case 'details':
        return true; // Optional step
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
        capacity: formData.capacity || undefined,
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
            onChange={(type) => {
              setFormData((prev) => ({ ...prev, eventType: type }));
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
            location={formData.location}
            capacity={formData.capacity}
            onLocationChange={(location) => setFormData((prev) => ({ ...prev, location }))}
            onCapacityChange={(capacity) => setFormData((prev) => ({ ...prev, capacity }))}
          />
        );
      case 'review':
        return <EventReviewStep formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <Card className="p-4 overflow-hidden">
      <EventWizardProgress
        currentStep={currentStep}
        onBack={goBack}
        onClose={onClose}
        canGoBack={currentStep > 0}
      />
      
      <div className="overflow-hidden">
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
          onSkip={step.isOptional ? goNext : undefined}
          isValid={isStepValid()}
          isLastStep={isLastStep}
          isLoading={isLoading}
          showSkip={step.isOptional}
        />
      )}
    </Card>
  );
}
