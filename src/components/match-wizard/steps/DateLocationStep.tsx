import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Calendar, MapPin, Plus, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { MatchWizardFormData } from "../hooks/useMatchWizardSteps";

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

interface Venue {
  id: string;
  name: string;
  city: string;
  state: string;
}

export function DateLocationStep({ formData, updateFormData }: DateLocationStepProps) {
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', city: '', state: '' });
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const yesterday = subDays(today, 1);
  const todayStr = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load recent custom locations
      const { data: recent } = await supabase
        .from('user_recent_locations')
        .select('id, name, city, state')
        .eq('user_id', user.id)
        .order('used_at', { ascending: false })
        .limit(5);

      // Load known venues (courts)
      const { data: courts } = await supabase
        .from('courts')
        .select('id, name, city, state')
        .order('name')
        .limit(10);

      setRecentLocations(recent || []);
      setVenues(courts || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (dateStr: string) => {
    updateFormData('matchDate', dateStr);
  };

  const handleCustomDateSelect = (date: Date | undefined) => {
    if (date) {
      updateFormData('matchDate', format(date, 'yyyy-MM-dd'));
    }
  };

  const handleVenueSelect = (venue: Venue) => {
    updateFormData('locationId', venue.id);
    updateFormData('customLocation', null);
  };

  const handleRecentLocationSelect = (location: RecentLocation) => {
    updateFormData('locationId', null);
    updateFormData('customLocation', {
      id: location.id,
      name: location.name,
      city: location.city || '',
      state: location.state || '',
    });
  };

  const handleAddLocation = () => {
    if (!newLocation.name.trim()) return;
    
    updateFormData('locationId', null);
    updateFormData('customLocation', {
      name: newLocation.name.trim(),
      city: newLocation.city.trim(),
      state: newLocation.state.trim(),
    });
    setShowAddLocation(false);
    setNewLocation({ name: '', city: '', state: '' });
  };

  const isLocationSelected = (id: string, isVenue: boolean) => {
    if (isVenue) {
      return formData.locationId === id;
    }
    return formData.customLocation?.id === id;
  };

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
            variant={formData.matchDate === todayStr ? "default" : "outline"}
            onClick={() => handleDateSelect(todayStr)}
            className="flex-1"
          >
            Today
          </Button>
          <Button
            variant={formData.matchDate === yesterdayStr ? "default" : "outline"}
            onClick={() => handleDateSelect(yesterdayStr)}
            className="flex-1"
          >
            Yesterday
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={
                  formData.matchDate !== todayStr && formData.matchDate !== yesterdayStr
                    ? "default"
                    : "outline"
                }
                className="flex-1"
              >
                {formData.matchDate !== todayStr && formData.matchDate !== yesterdayStr
                  ? format(new Date(formData.matchDate), 'MMM d')
                  : 'Pick Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarComponent
                mode="single"
                selected={new Date(formData.matchDate)}
                onSelect={handleCustomDateSelect}
                disabled={(date) => date > today}
                initialFocus
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

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recent Locations */}
            {recentLocations.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Recent</div>
                <div className="space-y-1.5">
                  {recentLocations.map(location => (
                    <Card
                      key={location.id}
                      className={`p-3 cursor-pointer transition-all ${
                        isLocationSelected(location.id, false)
                          ? 'ring-2 ring-primary bg-primary/5'
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => handleRecentLocationSelect(location)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{location.name}</div>
                          {(location.city || location.state) && (
                            <div className="text-xs text-muted-foreground">
                              {[location.city, location.state].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                        {isLocationSelected(location.id, false) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Venues */}
            {venues.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Venues
                </div>
                <div className="space-y-1.5">
                  {venues.map(venue => (
                    <Card
                      key={venue.id}
                      className={`p-3 cursor-pointer transition-all ${
                        isLocationSelected(venue.id, true)
                          ? 'ring-2 ring-primary bg-primary/5'
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => handleVenueSelect(venue)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{venue.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {venue.city}, {venue.state}
                          </div>
                        </div>
                        {isLocationSelected(venue.id, true) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* New custom location indicator */}
            {isNewCustomLocation && (
              <Card className="p-3 ring-2 ring-primary bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{formData.customLocation?.name}</div>
                    {(formData.customLocation?.city || formData.customLocation?.state) && (
                      <div className="text-xs text-muted-foreground">
                        {[formData.customLocation?.city, formData.customLocation?.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                  <Check className="h-4 w-4 text-primary" />
                </div>
              </Card>
            )}

            {/* Add new location button */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowAddLocation(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Location
            </Button>
          </div>
        )}
      </div>

      {/* Add Location Dialog */}
      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Location Name *</Label>
              <Input
                id="location-name"
                placeholder="e.g., Central Park Courts"
                value={newLocation.name}
                onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="location-city">City</Label>
                <Input
                  id="location-city"
                  placeholder="City"
                  value={newLocation.city}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-state">State</Label>
                <Input
                  id="location-state"
                  placeholder="State"
                  value={newLocation.state}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLocation(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLocation} disabled={!newLocation.name.trim()}>
              Add Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
