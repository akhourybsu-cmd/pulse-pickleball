import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface Suggestion {
  placeId: string;
  label: string;
  primary: string;
  secondary: string;
}

export interface VerifiedCity {
  placeId: string;
  name: string;
  city: string;
  state: string;
  country: string;
  /** Present for distance-based features; null for older geocoder responses. */
  latitude?: number | null;
  longitude?: number | null;
}

interface CityAutocompleteProps {
  onSelect: (city: VerifiedCity) => void;
}

/**
 * Verified city/town picker. Users cannot submit free-typed text — only
 * Google-canonical city, postal town, or admin-area results.
 */
export function CityAutocomplete({ onSelect }: CityAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounced = useDebounce(query, 250);
  // A session token bundles autocomplete + details into a single billable
  // session per Google's pricing rules. New token after every selection.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const q = debounced.trim();
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("geocode-city-search", {
          body: { action: "search", query: q, sessionToken: sessionTokenRef.current },
        });
        if (cancelled) return;
        if (error) {
          console.error("City search failed", error);
          setSuggestions([]);
        } else {
          setSuggestions((data?.suggestions ?? []) as Suggestion[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [debounced]);

  const handlePick = async (s: Suggestion) => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-city-search", {
        body: { action: "details", placeId: s.placeId, sessionToken: sessionTokenRef.current },
      });
      if (error || !data) {
        console.error("Place details failed", error);
        return;
      }
      onSelect(data as VerifiedCity);
      setQuery("");
      setSuggestions([]);
      setOpen(false);
      sessionTokenRef.current = crypto.randomUUID();
    } finally {
      setResolving(false);
    }
  };

  const showDropdown = open && (loading || suggestions.length > 0 || (debounced.trim().length >= 2 && !loading));

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search city or town…"
          className="pl-9"
          disabled={resolving}
        />
        {(loading || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
          {suggestions.length === 0 && !loading && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No matching cities. Keep typing…
            </div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(s)}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors"
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.primary}</div>
                {s.secondary && (
                  <div className="text-xs text-muted-foreground truncate">{s.secondary}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
