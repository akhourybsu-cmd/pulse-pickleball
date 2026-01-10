/**
 * Event Adapter Layer
 * Provides a unified interface for all event types without merging tables
 * Used by discovery, registration, and notification systems
 */

export type EventSourceType = 'unified' | 'round_robin' | 'tournament' | 'calendar' | 'citi';

export type EventLifecycleStatus = 
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'full'
  | 'checkin_open'
  | 'in_progress'
  | 'completed'
  | 'settled'
  | 'archived'
  | 'cancelled';

export interface VenueSummary {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
}

export interface UnifiedEventView {
  id: string;
  sourceType: EventSourceType;
  eventType: string; // round_robin, tournament, open_play, clinic, lesson, etc.
  title: string;
  description: string | null;
  venue: VenueSummary | null;
  location: string | null;
  timing: {
    start: Date;
    end: Date | null;
    timezone: string;
  };
  capacity: {
    max: number | null;
    current: number;
    waitlistEnabled: boolean;
    waitlistCount: number;
  };
  pricing: {
    amount: number;
    currency: string;
    label: string | null;
  };
  skillRange: {
    min: number | null;
    max: number | null;
    label: string | null;
  };
  status: EventLifecycleStatus;
  isPublished: boolean;
  registrationUrl: string;
  imageUrl: string | null;
  hostInfo: {
    type: 'venue' | 'group' | 'player' | 'court';
    id: string | null;
    name: string | null;
  };
  metadata: Record<string, unknown>;
}

// Skill level label mapping
const SKILL_LABELS: Record<string, string> = {
  'beginner': 'Beginner (2.0-2.5)',
  'intermediate': 'Intermediate (3.0-3.5)',
  'advanced': 'Advanced (4.0-4.5)',
  'open': 'All Levels',
};

function parseSkillLevel(skill: string | null): { min: number | null; max: number | null; label: string | null } {
  if (!skill) return { min: null, max: null, label: null };
  
  const label = SKILL_LABELS[skill.toLowerCase()] || skill;
  
  switch (skill.toLowerCase()) {
    case 'beginner':
      return { min: 2.0, max: 2.5, label };
    case 'intermediate':
      return { min: 3.0, max: 3.5, label };
    case 'advanced':
      return { min: 4.0, max: 4.5, label };
    case 'open':
    case 'all':
      return { min: null, max: null, label: 'All Levels' };
    default:
      return { min: null, max: null, label };
  }
}

function mapStatus(status: string | null, isPublished?: boolean): EventLifecycleStatus {
  if (!status) return isPublished ? 'published' : 'draft';
  
  const statusMap: Record<string, EventLifecycleStatus> = {
    'draft': 'draft',
    'published': 'published',
    'registration_open': 'registration_open',
    'registration_closed': 'registration_closed',
    'full': 'full',
    'checkin_open': 'checkin_open',
    'in_progress': 'in_progress',
    'live': 'in_progress',
    'completed': 'completed',
    'settled': 'settled',
    'archived': 'archived',
    'cancelled': 'cancelled',
    'upcoming': 'published',
  };
  
  return statusMap[status.toLowerCase()] || 'draft';
}

/**
 * Adapt unified_events table data to UnifiedEventView
 */
export function adaptUnifiedEvent(event: any, venue?: any): UnifiedEventView {
  return {
    id: event.id,
    sourceType: 'unified',
    eventType: event.event_type || 'event',
    title: event.title,
    description: event.description,
    venue: venue ? {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      city: venue.city,
      state: venue.state,
      logoUrl: venue.logo_url,
    } : null,
    location: event.location,
    timing: {
      start: new Date(event.start_time),
      end: event.end_time ? new Date(event.end_time) : null,
      timezone: event.timezone || 'America/New_York',
    },
    capacity: {
      max: event.max_participants,
      current: event.current_participants || 0,
      waitlistEnabled: event.waitlist_enabled || false,
      waitlistCount: 0, // Calculated separately
    },
    pricing: {
      amount: event.price_cents ? event.price_cents / 100 : 0,
      currency: 'usd',
      label: event.price_cents ? `$${(event.price_cents / 100).toFixed(2)}` : 'Free',
    },
    skillRange: parseSkillLevel(event.skill_level),
    status: mapStatus(event.status, event.is_published),
    isPublished: event.is_published || false,
    registrationUrl: `/events/${event.id}`,
    imageUrl: event.cover_image_url,
    hostInfo: {
      type: event.host_type || 'venue',
      id: event.host_venue_id || event.host_group_id || event.host_court_id,
      name: venue?.name || null,
    },
    metadata: {
      eventType: event.event_type,
      visibility: event.visibility,
    },
  };
}

/**
 * Adapt round_robin_events table data to UnifiedEventView
 */
export function adaptRoundRobin(event: any, court?: any): UnifiedEventView {
  const location = court ? `${court.name}, ${court.city}, ${court.state}` : event.other_location || event.location;
  
  return {
    id: event.id,
    sourceType: 'round_robin',
    eventType: 'round_robin',
    title: event.name,
    description: null,
    venue: null,
    location,
    timing: {
      start: new Date(`${event.event_date}T${event.start_time || '00:00'}`),
      end: event.end_time ? new Date(`${event.event_date}T${event.end_time}`) : null,
      timezone: 'America/New_York',
    },
    capacity: {
      max: null, // Round robins typically don't have fixed capacity
      current: 0, // Calculate from round_robin_players
      waitlistEnabled: false,
      waitlistCount: 0,
    },
    pricing: {
      amount: 0,
      currency: 'usd',
      label: 'Free',
    },
    skillRange: { min: null, max: null, label: null },
    status: mapStatus(event.status),
    isPublished: event.visibility !== 'private',
    registrationUrl: `/round-robin/${event.id}`,
    imageUrl: null,
    hostInfo: {
      type: 'player',
      id: event.organizer_id,
      name: null,
    },
    metadata: {
      numCourts: event.num_courts,
      pointsTo: event.points_to,
      ratingEligible: event.rating_eligible,
    },
  };
}

/**
 * Adapt calendar_events table data to UnifiedEventView
 */
export function adaptCalendarEvent(event: any, facility?: any): UnifiedEventView {
  return {
    id: event.id,
    sourceType: 'calendar',
    eventType: event.event_type || 'open_play',
    title: event.title,
    description: event.description,
    venue: facility ? {
      id: facility.id,
      name: facility.name,
      slug: null,
      city: null,
      state: null,
      logoUrl: null,
    } : null,
    location: facility?.name || null,
    timing: {
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      timezone: 'America/New_York',
    },
    capacity: {
      max: event.capacity,
      current: event.current_registrations || 0,
      waitlistEnabled: false,
      waitlistCount: 0,
    },
    pricing: {
      amount: event.price || 0,
      currency: 'usd',
      label: event.price ? `$${event.price.toFixed(2)}` : 'Free',
    },
    skillRange: parseSkillLevel(event.skill_level),
    status: 'published',
    isPublished: true,
    registrationUrl: `/events/calendar/${event.id}`,
    imageUrl: null,
    hostInfo: {
      type: 'venue',
      id: event.facility_id,
      name: facility?.name || null,
    },
    metadata: {
      courtNumber: event.court_number,
      instructor: event.instructor,
      seriesId: event.series_id,
    },
  };
}

/**
 * Adapt venue_events table data to UnifiedEventView
 */
export function adaptVenueEvent(event: any, venue?: any): UnifiedEventView {
  return {
    id: event.id,
    sourceType: 'unified',
    eventType: event.event_type || 'event',
    title: event.title,
    description: event.description,
    venue: venue ? {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      city: venue.city,
      state: venue.state,
      logoUrl: venue.logo_url,
    } : null,
    location: venue ? `${venue.city}, ${venue.state}` : null,
    timing: {
      start: new Date(event.start_time),
      end: event.end_time ? new Date(event.end_time) : null,
      timezone: 'America/New_York',
    },
    capacity: {
      max: event.capacity,
      current: event.current_participants || 0,
      waitlistEnabled: event.waitlist_enabled || false,
      waitlistCount: 0,
    },
    pricing: {
      amount: event.price || 0,
      currency: 'usd',
      label: event.price ? `$${event.price.toFixed(2)}` : 'Free',
    },
    skillRange: parseSkillLevel(event.skill_level),
    status: mapStatus(null, event.is_published),
    isPublished: event.is_published || false,
    registrationUrl: `/venue/${venue?.slug}/events/${event.id}`,
    imageUrl: event.cover_image_url,
    hostInfo: {
      type: 'venue',
      id: event.venue_id,
      name: venue?.name || null,
    },
    metadata: {
      eventType: event.event_type,
      instructor: event.instructor_name,
    },
  };
}

/**
 * Get display badge for event type
 */
export function getEventTypeBadge(eventType: string): { label: string; color: string; icon: string } {
  const badges: Record<string, { label: string; color: string; icon: string }> = {
    'round_robin': { label: 'Round Robin', color: 'bg-amber-500', icon: 'Users' },
    'tournament': { label: 'Tournament', color: 'bg-purple-500', icon: 'Trophy' },
    'open_play': { label: 'Open Play', color: 'bg-green-500', icon: 'Play' },
    'clinic': { label: 'Clinic', color: 'bg-blue-500', icon: 'GraduationCap' },
    'lesson': { label: 'Lesson', color: 'bg-cyan-500', icon: 'BookOpen' },
    'social': { label: 'Social', color: 'bg-pink-500', icon: 'Heart' },
    'league': { label: 'League', color: 'bg-orange-500', icon: 'Medal' },
    'private': { label: 'Private Rental', color: 'bg-gray-500', icon: 'Lock' },
  };
  
  return badges[eventType] || { label: eventType, color: 'bg-muted', icon: 'Calendar' };
}

/**
 * Get status display info
 */
export function getStatusDisplay(status: EventLifecycleStatus): { label: string; color: string; canRegister: boolean } {
  const displays: Record<EventLifecycleStatus, { label: string; color: string; canRegister: boolean }> = {
    'draft': { label: 'Draft', color: 'text-muted-foreground', canRegister: false },
    'published': { label: 'Coming Soon', color: 'text-blue-500', canRegister: false },
    'registration_open': { label: 'Open', color: 'text-green-500', canRegister: true },
    'registration_closed': { label: 'Closed', color: 'text-orange-500', canRegister: false },
    'full': { label: 'Full', color: 'text-red-500', canRegister: false },
    'checkin_open': { label: 'Check-in Open', color: 'text-purple-500', canRegister: false },
    'in_progress': { label: 'In Progress', color: 'text-amber-500', canRegister: false },
    'completed': { label: 'Completed', color: 'text-muted-foreground', canRegister: false },
    'settled': { label: 'Settled', color: 'text-muted-foreground', canRegister: false },
    'archived': { label: 'Archived', color: 'text-muted-foreground', canRegister: false },
    'cancelled': { label: 'Cancelled', color: 'text-destructive', canRegister: false },
  };
  
  return displays[status] || { label: status, color: 'text-muted-foreground', canRegister: false };
}
