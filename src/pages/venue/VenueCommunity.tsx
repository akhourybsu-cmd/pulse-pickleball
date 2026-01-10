import { useState, useEffect } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueDisplaySettings, VenueDisplaySettings } from '@/hooks/useVenueDisplaySettings';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useVenueTheme } from '@/components/layout/VenueShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Users, MessageSquare, Image, MapPin, Settings2 } from 'lucide-react';

export default function VenueCommunity() {
  const { currentVenueId } = useMode();
  const { displaySettings, loading: loadingDisplay, saving: savingDisplay, updateSettings: updateDisplaySettings } = useVenueDisplaySettings(currentVenueId);
  const { settings: venueSettings, loading: loadingVenue, saving: savingVenue, updateSettings: updateVenueSettings } = useVenueSettings(currentVenueId);
  const venueTheme = useVenueTheme();
  
  const [displayFormData, setDisplayFormData] = useState<Partial<VenueDisplaySettings>>({});
  const [announcement, setAnnouncement] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const loading = loadingDisplay || loadingVenue;
  const saving = savingDisplay || savingVenue;

  useEffect(() => {
    if (displaySettings) {
      setDisplayFormData(displaySettings);
    }
  }, [displaySettings]);

  useEffect(() => {
    if (venueSettings) {
      setAnnouncement((venueSettings as any).welcome_message || '');
    }
  }, [venueSettings]);

  const handleDisplayChange = (field: keyof VenueDisplaySettings, value: boolean) => {
    setDisplayFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAnnouncementChange = (value: string) => {
    setAnnouncement(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const displaySuccess = await updateDisplaySettings(displayFormData);
    const venueSuccess = await updateVenueSettings({ welcome_message: announcement } as any);
    
    if (displaySuccess && venueSuccess) {
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
          <h1 className="text-2xl font-bold">Community Settings</h1>
          <p className="text-muted-foreground">Manage community features and announcements</p>
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
        {/* Community Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Community Controls
            </CardTitle>
            <CardDescription>Manage how players interact with your venue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Player Posts</Label>
                <p className="text-xs text-muted-foreground">Players can share updates on your venue page</p>
              </div>
              <Switch
                checked={displayFormData.allow_player_posts ?? true}
                onCheckedChange={(checked) => handleDisplayChange('allow_player_posts', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Display Settings
            </CardTitle>
            <CardDescription>Control what's shown on your public venue page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                <Label>Show Gallery</Label>
              </div>
              <Switch
                checked={displayFormData.show_gallery ?? true}
                onCheckedChange={(checked) => handleDisplayChange('show_gallery', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label>Show Facility Details</Label>
              </div>
              <Switch
                checked={displayFormData.show_facility_details ?? true}
                onCheckedChange={(checked) => handleDisplayChange('show_facility_details', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <Label>Show Amenities</Label>
              </div>
              <Switch
                checked={displayFormData.show_amenities ?? true}
                onCheckedChange={(checked) => handleDisplayChange('show_amenities', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Venue Announcement */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Venue Announcement
            </CardTitle>
            <CardDescription>
              Display a welcome message or announcement at the top of your venue page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={announcement}
              onChange={(e) => handleAnnouncementChange(e.target.value)}
              placeholder="Welcome to our venue! We're excited to have you play with us..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This message appears prominently on your public venue page. Use it for announcements, 
              special events, or to welcome new players.
            </p>
            
            {/* Preview */}
            {announcement && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview:</p>
                <div 
                  className="p-3 rounded-md border-l-4"
                  style={{ borderLeftColor: venueTheme.primary }}
                >
                  <p className="text-sm">{announcement}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
