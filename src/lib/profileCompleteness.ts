/**
 * Profile Completeness Utilities
 * 
 * Functions to calculate profile completeness and tournament readiness
 */

export interface ProfileData {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  phonetic_name?: string | null;
  town?: string | null;
  state?: string | null;
  phone_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  shirt_size?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  skill_level_self?: string | null;
  home_court_id?: string | null;
  handedness?: string | null;
  play_side?: string | null;
  paddle_brand?: string | null;
  paddle_model?: string | null;
}

export interface SectionCompleteness {
  complete: number;
  total: number;
  percentage: number;
  status: 'complete' | 'partial' | 'incomplete';
}

export interface ProfileCompletenessResult {
  overallPercentage: number;
  tournamentReady: boolean;
  missingRequired: { field: string; label: string; reason: string }[];
  missingRecommended: { field: string; label: string; reason: string }[];
  sections: {
    basics: SectionCompleteness;
    tournament: SectionCompleteness;
    playStyle: SectionCompleteness;
  };
}

// Required fields for all tournaments
const ALWAYS_REQUIRED = [
  { field: 'first_name', label: 'First Name' },
  { field: 'last_name', label: 'Last Name' },
  { field: 'phone_number', label: 'Phone Number' },
];

// Fields required for specific tournament types
const SOMETIMES_REQUIRED = [
  { field: 'date_of_birth', label: 'Date of Birth', reason: 'Required for age-restricted divisions' },
  { field: 'gender', label: 'Gender', reason: 'Required for gender-specific divisions' },
  { field: 'emergency_contact_name', label: 'Emergency Contact Name', reason: 'Required by some tournaments' },
  { field: 'emergency_contact_phone', label: 'Emergency Contact Phone', reason: 'Required by some tournaments' },
];

// Recommended fields for better tournament experience
const RECOMMENDED = [
  { field: 'avatar_url', label: 'Profile Picture', reason: 'Helps others recognize you' },
  { field: 'shirt_size', label: 'Shirt Size', reason: 'For tournament merchandise' },
  { field: 'skill_level_self', label: 'Skill Level', reason: 'Helps with fair matchmaking' },
];

// Basics section fields
const BASICS_FIELDS = ['first_name', 'last_name', 'display_name', 'avatar_url', 'phonetic_name', 'town', 'state'];

// Tournament section fields  
const TOURNAMENT_FIELDS = ['date_of_birth', 'gender', 'phone_number', 'shirt_size', 'emergency_contact_name', 'emergency_contact_phone', 'skill_level_self'];

// Play style section fields
const PLAY_STYLE_FIELDS = ['home_court_id', 'handedness', 'play_side', 'paddle_brand', 'paddle_model'];

function hasValue(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== '';
}

function calculateSectionCompleteness(profile: ProfileData, fields: string[]): SectionCompleteness {
  let complete = 0;
  
  for (const field of fields) {
    const value = profile[field as keyof ProfileData];
    if (hasValue(value as string | null | undefined)) {
      complete++;
    }
  }
  
  const total = fields.length;
  const percentage = Math.round((complete / total) * 100);
  
  let status: 'complete' | 'partial' | 'incomplete' = 'incomplete';
  if (percentage === 100) {
    status = 'complete';
  } else if (percentage > 0) {
    status = 'partial';
  }
  
  return { complete, total, percentage, status };
}

export function calculateProfileCompleteness(profile: ProfileData): ProfileCompletenessResult {
  const missingRequired: { field: string; label: string; reason: string }[] = [];
  const missingRecommended: { field: string; label: string; reason: string }[] = [];
  
  // Check always-required fields
  for (const { field, label } of ALWAYS_REQUIRED) {
    const value = profile[field as keyof ProfileData];
    if (!hasValue(value as string | null | undefined)) {
      missingRequired.push({ field, label, reason: 'Required for tournament registration' });
    }
  }
  
  // Check sometimes-required fields (these become "recommended" in general view)
  for (const { field, label, reason } of SOMETIMES_REQUIRED) {
    const value = profile[field as keyof ProfileData];
    if (!hasValue(value as string | null | undefined)) {
      missingRecommended.push({ field, label, reason });
    }
  }
  
  // Check recommended fields
  for (const { field, label, reason } of RECOMMENDED) {
    const value = profile[field as keyof ProfileData];
    if (!hasValue(value as string | null | undefined)) {
      missingRecommended.push({ field, label, reason });
    }
  }
  
  // Calculate section completeness
  const sections = {
    basics: calculateSectionCompleteness(profile, BASICS_FIELDS),
    tournament: calculateSectionCompleteness(profile, TOURNAMENT_FIELDS),
    playStyle: calculateSectionCompleteness(profile, PLAY_STYLE_FIELDS),
  };
  
  // Overall percentage (weighted average of all sections)
  const totalFields = BASICS_FIELDS.length + TOURNAMENT_FIELDS.length + PLAY_STYLE_FIELDS.length;
  const totalComplete = sections.basics.complete + sections.tournament.complete + sections.playStyle.complete;
  const overallPercentage = Math.round((totalComplete / totalFields) * 100);
  
  // Tournament ready if all required fields are filled
  const tournamentReady = missingRequired.length === 0;
  
  return {
    overallPercentage,
    tournamentReady,
    missingRequired,
    missingRecommended,
    sections,
  };
}

/**
 * Check tournament readiness for a specific tournament's requirements
 */
export interface TournamentRequirements {
  requireEmergencyContact?: boolean;
  requireFullAddress?: boolean;
  hasAgeRestrictedDivisions?: boolean;
  hasGenderRestrictedDivisions?: boolean;
}

export function checkTournamentReadiness(
  profile: ProfileData,
  requirements?: TournamentRequirements
): { ready: boolean; missing: { field: string; label: string; reason: string }[] } {
  const missing: { field: string; label: string; reason: string }[] = [];
  
  // Always required
  if (!hasValue(profile.first_name)) {
    missing.push({ field: 'first_name', label: 'First Name', reason: 'Required for registration' });
  }
  if (!hasValue(profile.last_name)) {
    missing.push({ field: 'last_name', label: 'Last Name', reason: 'Required for registration' });
  }
  if (!hasValue(profile.phone_number)) {
    missing.push({ field: 'phone_number', label: 'Phone Number', reason: 'Required for tournament communications' });
  }
  
  // Conditionally required based on tournament settings
  if (requirements?.requireEmergencyContact) {
    if (!hasValue(profile.emergency_contact_name)) {
      missing.push({ field: 'emergency_contact_name', label: 'Emergency Contact Name', reason: 'Required by this tournament' });
    }
    if (!hasValue(profile.emergency_contact_phone)) {
      missing.push({ field: 'emergency_contact_phone', label: 'Emergency Contact Phone', reason: 'Required by this tournament' });
    }
  }
  
  if (requirements?.hasAgeRestrictedDivisions) {
    if (!hasValue(profile.date_of_birth)) {
      missing.push({ field: 'date_of_birth', label: 'Date of Birth', reason: 'Required for age-restricted divisions' });
    }
  }
  
  if (requirements?.hasGenderRestrictedDivisions) {
    if (!hasValue(profile.gender)) {
      missing.push({ field: 'gender', label: 'Gender', reason: 'Required for gender-specific divisions' });
    }
  }
  
  if (requirements?.requireFullAddress) {
    if (!hasValue(profile.town) || !hasValue(profile.state)) {
      missing.push({ field: 'town', label: 'Full Address', reason: 'Required by this tournament' });
    }
  }
  
  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Get the tab that should be focused based on missing fields
 */
export function getTabForField(field: string): string {
  if (BASICS_FIELDS.includes(field)) return 'basics';
  if (TOURNAMENT_FIELDS.includes(field)) return 'tournament';
  if (PLAY_STYLE_FIELDS.includes(field)) return 'playstyle';
  return 'basics';
}
