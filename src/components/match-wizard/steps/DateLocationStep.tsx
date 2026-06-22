import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, MapPin, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { MatchWizardFormData } from "../hooks/useMatchWizardSteps";
import { CityAutocomplete, VerifiedCity } from "../CityAutocomplete";
import { todayInEasternTime, parseDateLocal, formatDateLocal, cn } from "@/lib/utils";

interface DateLocationStepProps {
  formData: MatchWizardFormData;
  updateFormData: <K extends keyof MatchWizardFormData>(field: K, value: MatchWizardFormData[K]) => void;
}

interface RecentLocation {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export function DateLocationStep({ formData, updateFormData }: DateLocationStepProps) {
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = todayInEasternTime();
  const todayDate = parseDateLocal(todayStr);
  const isCustomDate = formData.matchDate !== todayStr;

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: recent } = await supabase
        .from("user_recent_locations")
        .select("id, name, city, state")
        .eq("user_id", user.id)
        .order("used_at", { ascending: false })
        .limit(6);

      setRecentLocations(recent || []);
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (dateStr: string) => {
    updateFormData("matchDate", dateStr);
  };

  const handleCustomDateSelect = (date: Date | undefined) => {
    if (date) {
      updateFormData("matchDate", formatDateLocal(date));
    }
  };

  const handleRecentLocationSelect = (location: RecentLocation) => {
    updateFormData("locationId", null);
    updateFormData("customLocation", {
      id: location.id,
      name: location.name,
      city: location.city || "",
      state: location.state || "",
    });
  };

  const handleVerifiedSelect = (city: VerifiedCity) => {
    updateFormData("locationId", null);
    updateFormData("customLocation", {
      placeId: city.placeId,
      name: city.name,
      city: city.city,
      state: city.state,
      country: city.country,
    });
  };

  const clearLocation = () => {
    updateFormData("locationId", null);
    updateFormData("customLocation", null);
  };

  const isRecentSelected = (id: string) => formData.customLocation?.id === id;
  const selected = formData.customLocation;
  const isVerifiedSelection = selected && !selected.id; // came from autocomplete, not recents

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Calendar className="h-4 w-4" />
          When did you play?
        </div>

        <div className="flex gap-2">
          <Button
            variant={!isCustomDate ? "default" : "outline"}
            onClick={() => handleDateSelect(todayStr)}
            className="flex-1"
          >
            Today
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={isCustomDate ? "default" : "outline"}
                className="flex-1"
              >
                {isCustomDate
                  ? format(parseDateLocal(formData.matchDate), "MMM d")
                  : "Select a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarComponent
                mode="single"
                selected={parseDateLocal(formData.matchDate)}
                onSelect={handleCustomDateSelect}
                disabled={(date) => date > todayDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Location Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Where did you play?
          </div>
          <span className="text-xs text-muted-foreground">Optional</span>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Search a verified city or town — no free typing, so spelling stays consistent across players.
        </p>

        {/* Currently selected (verified pick from autocomplete) */}
        {isVerifiedSelection && (
          <Card className="p-3 ring-2 ring-primary bg-primary/5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{selected?.name}</div>
                  <div className="text-xs text-muted-foreground">Verified location</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={clearLocation} className="h-7 w-7 flex-shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Autocomplete search */}
        {!isVerifiedSelection && (
          <CityAutocomplete onSelect={handleVerifiedSelect} />
        )}

        {/* Recent locations */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : recentLocations.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Recent</div>
            <div className="space-y-1.5">
              {recentLocations.map((location) => (
                <Card
                  key={location.id}
                  className={`p-3 cursor-pointer transition-all ${
                    isRecentSelected(location.id)
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => handleRecentLocationSelect(location)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{location.name}</div>
                    </div>
                    {isRecentSelected(location.id) && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <Button variant="ghost" size="sm" onClick={clearLocation} className="w-full text-muted-foreground">
            <X className="h-4 w-4 mr-2" />
            Clear location
          </Button>
        )}
      </div>
    </div>
  );
}
