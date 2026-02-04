import { supabase } from "@/integrations/supabase/client";

// Reserved slugs that cannot be used
const RESERVED_SLUGS = [
  "new",
  "create",
  "admin",
  "register",
  "list",
  "all",
  "search",
  "browse",
  "edit",
  "delete",
  "settings",
  "api",
  "dashboard",
];

/**
 * Format a string into a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes special characters
 * - Collapses multiple hyphens
 * - Trims leading/trailing hyphens
 */
export function formatSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/[^a-z0-9-]/g, "") // remove special chars
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

/**
 * Generate a suggested slug from a tournament name
 */
export function generateSlugFromName(name: string): string {
  return formatSlug(name).slice(0, 50); // Max 50 chars
}

/**
 * Validate slug format and constraints
 */
export function validateSlugFormat(slug: string): {
  valid: boolean;
  error?: string;
} {
  if (!slug) {
    return { valid: true }; // Empty is allowed (optional field)
  }

  if (slug.length < 3) {
    return { valid: false, error: "URL must be at least 3 characters" };
  }

  if (slug.length > 50) {
    return { valid: false, error: "URL must be 50 characters or less" };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      valid: false,
      error: "Only lowercase letters, numbers, and hyphens allowed",
    };
  }

  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { valid: false, error: "URL cannot start or end with a hyphen" };
  }

  if (RESERVED_SLUGS.includes(slug)) {
    return { valid: false, error: "This URL is reserved and cannot be used" };
  }

  return { valid: true };
}

/**
 * Check if a slug is available (not already in use)
 * @param slug - The slug to check
 * @param excludeEventId - Optional event ID to exclude (for editing existing tournaments)
 */
export async function isSlugAvailable(
  slug: string,
  excludeEventId?: string
): Promise<boolean> {
  if (!slug) return true;

  let query = supabase
    .from("tournaments_events")
    .select("id")
    .eq("slug", slug);

  if (excludeEventId) {
    query = query.neq("id", excludeEventId);
  }

  const { data } = await query.maybeSingle();
  return !data;
}

/**
 * Full slug validation including format and availability
 */
export async function validateSlug(
  slug: string,
  excludeEventId?: string
): Promise<{
  valid: boolean;
  error?: string;
  available?: boolean;
}> {
  // First check format
  const formatResult = validateSlugFormat(slug);
  if (!formatResult.valid) {
    return formatResult;
  }

  // Then check availability
  if (slug) {
    const available = await isSlugAvailable(slug, excludeEventId);
    if (!available) {
      return { valid: false, error: "This URL is already taken", available: false };
    }
    return { valid: true, available: true };
  }

  return { valid: true };
}
