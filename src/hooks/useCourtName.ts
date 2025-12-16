import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// UUID regex to check if location is a court ID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Hook to resolve a location string to a court name.
 * If the location is a UUID (court ID), fetches the court name.
 * Otherwise, returns the location as-is.
 */
export function useCourtName(location: string | null | undefined): string | null {
  const [courtName, setCourtName] = useState<string | null>(null);

  useEffect(() => {
    if (!location) {
      setCourtName(null);
      return;
    }

    // Check if location is a UUID
    if (UUID_REGEX.test(location)) {
      // Fetch court name
      const fetchCourtName = async () => {
        const { data } = await supabase
          .from("courts")
          .select("name")
          .eq("id", location)
          .single();
        
        setCourtName(data?.name || location);
      };
      fetchCourtName();
    } else {
      // Not a UUID, use as-is
      setCourtName(location);
    }
  }, [location]);

  return courtName;
}

/**
 * Utility function to resolve a location string to a court name synchronously
 * from a pre-fetched courts map.
 */
export function resolveCourtName(
  location: string | null | undefined,
  courtsMap: Map<string, string>
): string | null {
  if (!location) return null;
  
  if (UUID_REGEX.test(location)) {
    return courtsMap.get(location) || location;
  }
  
  return location;
}
