import { useState, useEffect } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueFacility, VenueFacilityDetails } from '@/hooks/useVenueFacility';
import { useVenueTheme } from '@/components/layout/VenueShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, MapPin, Sun, Droplets, Car, Users, ShoppingBag, Utensils, Lightbulb, Thermometer } from 'lucide-react';

const LOCATION_TYPES = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'mixed', label: 'Mixed (Indoor & Outdoor)' },
];

const SURFACE_TYPES = [
  { value: 'hard', label: 'Hard Court' },
  { value: 'wood', label: 'Wood' },
  { value: 'sport_court', label: 'Sport Court' },
  { value: 'clay', label: 'Clay' },
  { value: 'other', label: 'Other' },
];

export default function VenueFacility() {
  const { currentVenueId } = useMode();
  const { facility, loading, saving, updateFacility } = useVenueFacility(currentVenueId);
  const venueTheme = useVenueTheme();
  
  const [formData, setFormData] = useState<Partial<VenueFacilityDetails>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (facility) {
      setFormData(facility);
      setHasChanges(false);
    }
  }, [facility]);

  const handleChange = (field: keyof VenueFacilityDetails, value: string | boolean | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const success = await updateFacility(formData);
    if (success) {
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facility Details</h1>
          <p className="text-muted-foreground">Describe your courts and amenities</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saving}
          style={{ backgroundColor: venueTheme.primary }}
          className="hover:opacity-90"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Court Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Courts
            </CardTitle>
            <CardDescription>Information about your pickleball courts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="court_count">Number of Courts</Label>
              <Input
                id="court_count"
                type="number"
                min={0}
                max={100}
                value={formData.court_count || 0}
                onChange={(e) => handleChange('court_count', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Location Type</Label>
              <Select
                value={formData.location_type || 'mixed'}
                onValueChange={(value) => handleChange('location_type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Surface Type</Label>
              <Select
                value={formData.surface_type || 'other'}
                onValueChange={(value) => handleChange('surface_type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select surface type" />
                </SelectTrigger>
                <SelectContent>
                  {SURFACE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
                <Label>Lighting Available</Label>
              </div>
              <Switch
                checked={formData.has_lighting || false}
                onCheckedChange={(checked) => handleChange('has_lighting', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <Label>Climate Controlled</Label>
              </div>
              <Switch
                checked={formData.climate_controlled || false}
                onCheckedChange={(checked) => handleChange('climate_controlled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Amenities */}
        <Card>
          <CardHeader>
            <CardTitle>Amenities</CardTitle>
            <CardDescription>What facilities are available for players</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Label>Restrooms</Label>
                </div>
                <Switch
                  checked={formData.amenity_restrooms || false}
                  onCheckedChange={(checked) => handleChange('amenity_restrooms', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-muted-foreground" />
                  <Label>Water Available</Label>
                </div>
                <Switch
                  checked={formData.amenity_water || false}
                  onCheckedChange={(checked) => handleChange('amenity_water', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <Label>Parking</Label>
                </div>
                <Switch
                  checked={formData.amenity_parking || false}
                  onCheckedChange={(checked) => handleChange('amenity_parking', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label>Seating Area</Label>
                </div>
                <Switch
                  checked={formData.amenity_seating || false}
                  onCheckedChange={(checked) => handleChange('amenity_seating', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <Label>Pro Shop</Label>
                </div>
                <Switch
                  checked={formData.amenity_pro_shop || false}
                  onCheckedChange={(checked) => handleChange('amenity_pro_shop', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                  <Label>Food Nearby</Label>
                </div>
                <Switch
                  checked={formData.amenity_food_nearby || false}
                  onCheckedChange={(checked) => handleChange('amenity_food_nearby', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Play Options */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Play Options & Programs</CardTitle>
            <CardDescription>What types of play do you offer?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Open Play Available</Label>
                    <p className="text-xs text-muted-foreground">Casual drop-in play sessions</p>
                  </div>
                  <Switch
                    checked={formData.offers_open_play || false}
                    onCheckedChange={(checked) => handleChange('offers_open_play', checked)}
                  />
                </div>
                {formData.offers_open_play && (
                  <div className="space-y-2">
                    <Label>Open Play Notes</Label>
                    <Textarea
                      value={formData.open_play_notes || ''}
                      onChange={(e) => handleChange('open_play_notes', e.target.value)}
                      placeholder="e.g., Tuesdays & Thursdays 6-8pm, all levels welcome..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Beginner Friendly</Label>
                    <p className="text-xs text-muted-foreground">Welcoming to new players</p>
                  </div>
                  <Switch
                    checked={formData.beginner_friendly || false}
                    onCheckedChange={(checked) => handleChange('beginner_friendly', checked)}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Programs & Lessons Notes</Label>
              <Textarea
                value={formData.programs_notes || ''}
                onChange={(e) => handleChange('programs_notes', e.target.value)}
                placeholder="Describe any clinics, lessons, leagues, or programs you offer..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Tell players about your coaching, clinics, leagues, or other programs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
