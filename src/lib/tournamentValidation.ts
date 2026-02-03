import { differenceInYears, parse } from "date-fns";

interface PlayerProfile {
  id: string;
  current_rating?: number | null;
  date_of_birth?: string | null;
  gender?: string | null;
}

interface Division {
  id: string;
  name: string;
  skill_level_min?: number | null;
  skill_level_max?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  age_group?: string | null;
  gender?: string | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * Calculate player's age on a given date (typically Dec 31 of tournament year)
 */
export function calculateAgeOnDate(
  birthDate: string | null | undefined,
  referenceDate: Date
): number | null {
  if (!birthDate) return null;
  
  try {
    const dob = new Date(birthDate);
    return differenceInYears(referenceDate, dob);
  } catch {
    return null;
  }
}

/**
 * Get the age determination date for a tournament
 * Typically December 31st of the tournament year
 */
export function getAgeDeterminationDate(tournamentStartDate: string): Date {
  const startDate = new Date(tournamentStartDate);
  const year = startDate.getFullYear();
  return new Date(year, 11, 31); // December 31st of tournament year
}

/**
 * Check if a player is eligible for a specific division
 */
export function checkDivisionEligibility(
  player: PlayerProfile,
  division: Division,
  tournamentStartDate?: string
): EligibilityResult {
  const reasons: string[] = [];
  let eligible = true;

  // Check skill level eligibility
  if (division.skill_level_min !== null && division.skill_level_min !== undefined) {
    const playerRating = player.current_rating || 0;
    if (playerRating < division.skill_level_min) {
      eligible = false;
      reasons.push(`Your rating (${playerRating.toFixed(1)}) is below the minimum (${division.skill_level_min.toFixed(1)})`);
    }
  }

  if (division.skill_level_max !== null && division.skill_level_max !== undefined) {
    const playerRating = player.current_rating || 0;
    if (playerRating > division.skill_level_max) {
      eligible = false;
      reasons.push(`Your rating (${playerRating.toFixed(1)}) exceeds the maximum (${division.skill_level_max.toFixed(1)})`);
    }
  }

  // Check age eligibility
  if (tournamentStartDate && (division.age_min || division.age_max)) {
    const ageDeterminationDate = getAgeDeterminationDate(tournamentStartDate);
    const playerAge = calculateAgeOnDate(player.date_of_birth, ageDeterminationDate);

    if (playerAge !== null) {
      if (division.age_min && playerAge < division.age_min) {
        eligible = false;
        reasons.push(`You must be at least ${division.age_min} years old`);
      }
      if (division.age_max && playerAge > division.age_max) {
        eligible = false;
        reasons.push(`You must be ${division.age_max} or younger`);
      }
    } else if (division.age_min || division.age_max) {
      // Player hasn't set DOB but division has age requirements
      reasons.push("Date of birth required for age-restricted divisions");
    }
  }

  // Check gender eligibility
  if (division.gender && division.gender !== "open") {
    const playerGender = player.gender?.toLowerCase();
    const requiredGender = division.gender.toLowerCase();
    
    if (requiredGender === "mens" && playerGender !== "male") {
      eligible = false;
      reasons.push("This division is for men only");
    } else if (requiredGender === "womens" && playerGender !== "female") {
      eligible = false;
      reasons.push("This division is for women only");
    }
  }

  return { eligible, reasons };
}

/**
 * Check if a player can register for more events in this tournament
 */
export function checkMaxEventsEligibility(
  currentRegistrations: number,
  maxEventsPerPlayer: number | null
): EligibilityResult {
  if (maxEventsPerPlayer === null || maxEventsPerPlayer === undefined) {
    return { eligible: true, reasons: [] };
  }

  if (currentRegistrations >= maxEventsPerPlayer) {
    return {
      eligible: false,
      reasons: [`You have reached the maximum of ${maxEventsPerPlayer} registrations for this tournament`],
    };
  }

  return { eligible: true, reasons: [] };
}

/**
 * Validate partner requirement
 */
export function checkPartnerRequirement(
  hasPartner: boolean,
  partnerId: string | null,
  requirePartnerAccount: boolean
): EligibilityResult {
  if (!requirePartnerAccount) {
    return { eligible: true, reasons: [] };
  }

  if (!hasPartner || !partnerId) {
    return {
      eligible: false,
      reasons: ["A registered partner with a PULSE account is required for this tournament"],
    };
  }

  return { eligible: true, reasons: [] };
}
