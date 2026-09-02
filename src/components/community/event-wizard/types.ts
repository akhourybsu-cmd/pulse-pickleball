export type RecurringFrequency = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

/** Persisted on group_events.event_format. */
export type EventFormat = 'open_play' | 'round_robin' | 'practice' | 'social' | 'clinic' | 'other';

export type RotationStyle =
  | 'paddle_stack'
  | 'timed_rotation'
  | 'winners_stay'
  | 'organized_games'
  | 'coach_led';

export interface EventWizardFormData {
  eventType: EventFormat | null;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number | null;
  /** Waitlist accepts overflow RSVPs once capacity is reached. */
  waitlistEnabled: boolean;
  /** Optional cap on the waitlist itself. null = unlimited. */
  waitlistLimit: number | null;
  /** Round robin only — number of courts available. */
  rrCourts: number | null;
  /** Round robin only — games each player should get. */
  rrGamesPerPlayer: number | null;
  /** Recurrence frequency — 'none' = single event. */
  recurringFrequency: RecurringFrequency;
  /** Total occurrences including the first one, 2-12. Ignored when frequency='none'. */
  recurringCount: number;
  /** Venue programming only — the playing surfaces blocked by this session. */
  selectedCourtIds: string[];
  /** Optional DUPR-style range for who the session is designed for. */
  skillLevelMin: number | null;
  skillLevelMax: number | null;
  /** How players move through games during venue programming. */
  rotationStyle: RotationStyle | null;
}

export interface VenueEventCourt {
  id: string;
  name: string | null;
  court_number: number | null;
  is_active?: boolean | null;
  surface_type?: string | null;
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
  { id: 'type', label: 'Format' },
  { id: 'name', label: 'Name' },
  { id: 'datetime', label: 'When' },
  { id: 'details', label: 'Details', isOptional: true },
  { id: 'review', label: 'Review' },
];

export const EVENT_TYPE_OPTIONS: {
  value: EventFormat;
  label: string;
  tagline: string;
  icon: string;
}[] = [
  { value: 'open_play',   label: 'Open Play',   tagline: 'Drop-in games with a player rotation', icon: '🏓' },
  { value: 'round_robin', label: 'Round Robin', tagline: 'Structured rounds and matchups',      icon: '🔄' },
  { value: 'practice',    label: 'Practice',    tagline: 'Dedicated drills and skills work',    icon: '🎯' },
  { value: 'clinic',      label: 'Clinic',      tagline: 'Coach-led instruction and training',  icon: '📣' },
  { value: 'social',      label: 'Social',      tagline: 'Community play and off-court time',   icon: '🎉' },
  { value: 'other',       label: 'Other',       tagline: 'A custom program or venue event',     icon: '📅' },
];

export const EVENT_FORMAT_LABELS: Record<EventFormat, string> = {
  open_play: 'Open Play',
  round_robin: 'Round Robin',
  practice: 'Practice',
  clinic: 'Clinic',
  social: 'Social',
  other: 'Event',
};

export function generateDefaultEventTitle(eventType: EventFormat | null): string {
  const typeLabels: Record<EventFormat, string> = {
    open_play: 'Open Play Session',
    round_robin: 'Round Robin',
    practice: 'Practice Session',
    clinic: 'Skills Clinic',
    social: 'Social Meetup',
    other: 'Group Event',
  };
  return eventType ? typeLabels[eventType] : 'Group Event';
}

export const INITIAL_EVENT_WIZARD_DATA: EventWizardFormData = {
  eventType: null,
  title: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  capacity: null,
  waitlistEnabled: true,
  waitlistLimit: null,
  rrCourts: null,
  rrGamesPerPlayer: null,
  recurringFrequency: 'none',
  recurringCount: 4,
  selectedCourtIds: [],
  skillLevelMin: null,
  skillLevelMax: null,
  rotationStyle: null,
};

export const ROTATION_OPTIONS: {
  value: RotationStyle;
  label: string;
  description: string;
  formats: EventFormat[];
}[] = [
  {
    value: 'paddle_stack',
    label: 'Paddle stack',
    description: 'Players queue and rotate onto the next open court.',
    formats: ['open_play', 'social'],
  },
  {
    value: 'timed_rotation',
    label: 'Timed rotation',
    description: 'All courts rotate together on a set cadence.',
    formats: ['open_play', 'practice', 'clinic'],
  },
  {
    value: 'winners_stay',
    label: 'Winners stay',
    description: 'Winning side stays for the next challenger.',
    formats: ['open_play'],
  },
  {
    value: 'organized_games',
    label: 'Organized games',
    description: 'Staff sets matchups and court assignments.',
    formats: ['open_play', 'round_robin', 'practice'],
  },
  {
    value: 'coach_led',
    label: 'Coach-led',
    description: 'A coach controls drills, groups, and rotations.',
    formats: ['clinic', 'practice'],
  },
];

export const ROTATION_LABELS: Record<RotationStyle, string> = Object.fromEntries(
  ROTATION_OPTIONS.map((option) => [option.value, option.label]),
) as Record<RotationStyle, string>;

export function suggestedPlayersPerCourt(eventType: EventFormat | null): number {
  switch (eventType) {
    case 'round_robin':
      return 4;
    case 'clinic':
    case 'practice':
      return 6;
    case 'social':
      return 8;
    case 'open_play':
    default:
      return 8;
  }
}
