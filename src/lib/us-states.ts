/**
 * Shared US states constant.
 *
 * The codebase historically stored state in two formats:
 *  - 2-letter codes ("MA", "RI") in venue forms and most profile forms
 *  - Full names ("Massachusetts", "Rhode Island") in the Auth signup form
 *
 * To avoid a risky data migration, this module exports BOTH derived arrays
 * from a single source of truth. Each form should keep using the format it
 * already stores so existing rows remain valid. Format normalization can
 * happen later as a dedicated migration.
 */

export interface USStateOption {
  /** USPS 2-letter postal abbreviation (e.g. "MA"). */
  code: string;
  /** Full state name as commonly written (e.g. "Massachusetts"). */
  name: string;
}

/** Canonical list of US states + DC. Single source of truth. */
export const US_STATE_OPTIONS: readonly USStateOption[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

/** Array of 2-letter codes only. Use in forms that store the code (e.g. venue address). */
export const US_STATE_CODES: readonly string[] = US_STATE_OPTIONS.map((s) => s.code);

/** Array of full names only. Use in forms that store the full name (e.g. Auth signup). */
export const US_STATE_NAMES: readonly string[] = US_STATE_OPTIONS.map((s) => s.name);

/** Look up the full name for a 2-letter code. Returns undefined if not found. */
export function getStateName(code: string): string | undefined {
  return US_STATE_OPTIONS.find((s) => s.code === code)?.name;
}

/** Look up the 2-letter code for a full name. Returns undefined if not found. */
export function getStateCode(name: string): string | undefined {
  return US_STATE_OPTIONS.find((s) => s.name === name)?.code;
}
