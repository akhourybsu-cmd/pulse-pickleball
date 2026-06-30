export type RecurringFrequency = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface EventWizardFormData {
  eventType: 'open_play' | 'practice' | 'social' | 'other' | null;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number | null;
  /** Recurrence frequency — 'none' = single event. */
  recurringFrequency: RecurringFrequency;
  /** Total occurrences including the first one, 2-12. Ignored when frequency='none'. */
  recurringCount: number;
}

export const RECURRING_OPTIONS: { value: RecurringFrequency; label: string; description: string }[] = [
  { value: 'none',     label: 'Does not repeat', description: 'A one-time event' },
  { value: 'daily',    label: 'Daily',           description: 'Every day at this time' },
  { value: 'weekly',   label: 'Weekly',          description: 'Same day each week' },
  { value: 'biweekly', label: 'Every 2 weeks',   description: 'Alternating weeks' },
  { value: 'monthly',  label: 'Monthly',         description: 'Same day each month' },
];

/**
 * Encode a recurrence as a short string per row (stored on
 * group_events.recurring_rule). Lightweight format we control;
 * upgradeable to RFC 5545 RRULE later without table changes.
 * Example: "WEEKLY:8" = weekly cadence, 8 occurrences total.
 */
export function encodeRecurringRule(freq: RecurringFrequency, count: number): string | null {
  if (freq === 'none') return null;
  return `${freq.toUpperCase()}:${count}`;
}

/**
 * Generate the list of ISO start timestamps for a recurring series,
 * starting at `firstStart`. Returns `[firstStart]` for 'none'.
 */
export function generateOccurrenceStarts(
  firstStart: Date,
  freq: RecurringFrequency,
  count: number,
): Date[] {
  if (freq === 'none' || count <= 1) return [firstStart];
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(firstStart);
    switch (freq) {
      case 'daily':    d.setDate(d.getDate() + i); break;
      case 'weekly':   d.setDate(d.getDate() + i * 7); break;
      case 'biweekly': d.setDate(d.getDate() + i * 14); break;
      // setMonth() handles month-length differences (e.g. Jan 31 -> Feb 28)
      case 'monthly':  d.setMonth(d.getMonth() + i); break;
    }
    out.push(d);
  }
  return out;
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
