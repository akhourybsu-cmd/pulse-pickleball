export interface EventWizardFormData {
  eventType: 'open_play' | 'practice' | 'social' | 'other' | null;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number | null;
}

export interface EventWizardStep {
  id: string;
  label: string;
  isOptional?: boolean;
}

export const EVENT_WIZARD_STEPS: EventWizardStep[] = [
  { id: 'type', label: 'Type' },
  { id: 'name', label: 'Name' },
  { id: 'datetime', label: 'When' },
  { id: 'details', label: 'Details', isOptional: true },
  { id: 'review', label: 'Review' },
];

export const EVENT_TYPE_OPTIONS = [
  { value: 'open_play', label: 'Open Play', icon: '🏓' },
  { value: 'practice', label: 'Practice', icon: '🎯' },
  { value: 'social', label: 'Social', icon: '🎉' },
  { value: 'other', label: 'Other', icon: '📅' },
] as const;

export function generateDefaultEventTitle(eventType: EventWizardFormData['eventType']): string {
  const typeLabels: Record<string, string> = {
    open_play: 'Open Play Session',
    practice: 'Practice Session',
    social: 'Social Meetup',
    other: 'Group Event',
  };
  return eventType ? typeLabels[eventType] : 'Group Event';
}
