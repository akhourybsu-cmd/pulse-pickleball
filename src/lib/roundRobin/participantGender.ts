import type { EventFormat } from "./scheduleCore";

export type BinaryGender = "male" | "female";

export interface ParticipantGenderEligibility {
  eligible: boolean;
  normalizedGender: BinaryGender | null;
  reason: string | null;
}

export function normalizeBinaryGender(
  gender: string | null | undefined,
): BinaryGender | null {
  const normalized = gender?.trim().toLowerCase();
  return normalized === "male" || normalized === "female"
    ? normalized
    : null;
}

export function requiredGenderForFormat(
  format: EventFormat,
): BinaryGender | null {
  return format === "male" || format === "female" ? format : null;
}

/**
 * Determines whether a participant can be scheduled in the selected format.
 * Open events intentionally accept every stored value (including null) so
 * existing open-format roster behavior remains unchanged.
 */
export function participantGenderEligibility(
  format: EventFormat,
  gender: string | null | undefined,
): ParticipantGenderEligibility {
  const normalizedGender = normalizeBinaryGender(gender);

  if (format === "open") {
    return { eligible: true, normalizedGender, reason: null };
  }

  if (format === "mixed") {
    return normalizedGender
      ? { eligible: true, normalizedGender, reason: null }
      : {
          eligible: false,
          normalizedGender: null,
          reason: "Mixed play requires male or female gender for scheduling.",
        };
  }

  return normalizedGender === format
    ? { eligible: true, normalizedGender, reason: null }
    : {
        eligible: false,
        normalizedGender,
        reason: `${format === "male" ? "Men's" : "Women's"} play requires ${format} players.`,
      };
}

/** Fixed-gender events assign the only valid value automatically. */
export function resolveGuestGenderForCreate(
  format: EventFormat,
  selectedGender: string | null | undefined,
): BinaryGender | null {
  if (format === "open") return null;
  return requiredGenderForFormat(format) ?? normalizeBinaryGender(selectedGender);
}

export function rosterGenderIssue(
  format: EventFormat,
  genders: readonly (string | null | undefined)[],
): string | null {
  if (format === "open") return null;

  const normalized = genders.map(normalizeBinaryGender);
  const invalidCount = normalized.filter((gender, index) =>
    !participantGenderEligibility(format, genders[index]).eligible,
  ).length;

  if (invalidCount > 0) {
    if (format === "mixed") {
      return `${invalidCount} selected ${invalidCount === 1 ? "player needs" : "players need"} male or female gender before mixed play can be scheduled.`;
    }
    return `${format === "male" ? "Men's" : "Women's"} play requires every selected player to be marked ${format}.`;
  }

  if (format === "mixed") {
    const maleCount = normalized.filter((gender) => gender === "male").length;
    const femaleCount = normalized.filter((gender) => gender === "female").length;
    if (maleCount < 2 || femaleCount < 2) {
      return "Mixed play requires at least 2 male and 2 female players.";
    }
  }

  return null;
}
