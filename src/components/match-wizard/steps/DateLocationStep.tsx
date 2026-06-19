import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, MapPin, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { MatchWizardFormData } from "../hooks/useMatchWizardSteps";
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

/**
 * Build a clean display label for a location. PULSE is going global, so
 * we anchor on city/state/zip rather than maintaining a court database.
 */
function composeLocationLabel(city: string, state: string, zip: string): string {
  const cityPart = city.trim();
  const statePart = state.trim();
  const zipPart = zip.trim();
  if (!cityPart && !statePart && !zipPart) return "";
  const left = [cityPart, statePart].filter(Boolean).join(", ");
  return [left, zipPart].filter(Boolean).join(" ").trim();
}

export function DateLocationStep({ formData, updateFormData }: DateLocationStepProps) {
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ city: "", state: "", zip: "" });
  const [loading, setLoading] = useState(true);

  // Today is anchored in America/New_York so the Today button always matches
  // the calendar date the user sees on their wall clock, even across DST.
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
      // formatDateLocal preserves the calendar day the user tapped instead of
      // routing through UTC and shifting it.
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

  const handleAddLocation = () => {
    const label = composeLocationLabel(newLocation.city, newLocation.state, newLocation.zip);
    if (!label) return;

    updateFormData("locationId", null);
    updateFormData("customLocation", {
      name: label,
      city: newLocation.city.trim(),
      state: newLocation.state.trim(),
    });
    setShowAddLocation(false);
    setNewLocation({ city: "", state: "", zip: "" });
  };

  const isRecentSelected = (id: string) => formData.customLocation?.id === id;
  const isNewCustomLocation = formData.customLocation && !formData.customLocation.id;

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
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Where did you play?
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          City or town — no need to pick a specific court.
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {recentLocations.length > 0 && (
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
                          {(location.city || location.state) && location.name !==
                            [location.city, location.state].filter(Boolean).join(", ") && (
                            <div className="text-xs text-muted-foreground truncate">
                              {[location.city, location.state].filter(Boolean).join(", ")}
                            </div>
                          )}
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

            {isNewCustomLocation && (
              <Card className="p-3 ring-2 ring-primary bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{formData.customLocation?.name}</div>
                  </div>
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                </div>
              </Card>
            )}

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowAddLocation(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add new location
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-city">City or town *</Label>
              <Input
                id="location-city"
                placeholder="e.g., Brooklyn"
                value={newLocation.city}
                onChange={(e) => setNewLocation((prev) => ({ ...prev, city: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="location-state">State / region</Label>
                <Input
                  id="location-state"
                  placeholder="NY"
                  value={newLocation.state}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-zip">Zip / postal</Label>
                <Input
                  id="location-zip"
                  placeholder="11201"
                  value={newLocation.zip}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, zip: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLocation(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddLocation}
              disabled={!newLocation.city.trim() && !newLocation.zip.trim()}
            >
              Add location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
