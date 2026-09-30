import { useEffect, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CommunityArea } from "@/lib/community/discovery";
export function CommunitySearchControls({
  search,
  onSearch,
  area,
  onArea,
  savedArea,
}: {
  search: string;
  onSearch: (value: string) => void;
  area: CommunityArea;
  onArea: (value: CommunityArea | null) => void;
  savedArea?: CommunityArea;
}) {
  const [city, setCity] = useState(area.city),
    [state, setState] = useState(area.state);
  useEffect(() => {
    setCity(area.city);
    setState(area.state);
  }, [area.city, area.state]);
  return (
    <section aria-label="Find communities" className="mb-5 space-y-3">
      <label className="block text-sm font-semibold" htmlFor="community-search">
        Search communities
      </label>
      <div role="search" className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="community-search"
          type="search"
          autoComplete="off"
          placeholder="Search by name, venue, or town"
          maxLength={100}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-12 rounded-xl bg-card pl-11 pr-12 text-base [&::-webkit-search-cancel-button]:appearance-none"
        />
        {search && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Clear community search"
            className="absolute right-1 top-1 h-10 w-10"
            onClick={() => onSearch("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <details className="rounded-xl border bg-card px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          <MapPin
            className="mr-1 inline h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          {area.state
            ? [area.city, area.state].filter(Boolean).join(", ") + " first"
            : "Choose an area"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Change area
          </span>
        </summary>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onArea({ city: city.trim(), state: state.trim() });
          }}
        >
          <p className="text-xs leading-5 text-muted-foreground">
            Communities in this town and state appear first, followed by other
            areas. This does not change your profile.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              City / town
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                placeholder="Attleboro"
              />
            </label>
            <label className="space-y-1 text-xs">
              State / region
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={80}
                placeholder="MA or Massachusetts"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={!state.trim()}>
              Use this area
            </Button>
            {savedArea?.state && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onArea(null)}
              >
                Use profile area
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onArea({ city: "", state: "" })}
            >
              Browse everywhere
            </Button>
          </div>
        </form>
      </details>
    </section>
  );
}
