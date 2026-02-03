import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EventSettings {
  id?: string;
  event_id: string;
  max_events_per_player: number;
  max_events_per_day: number | null;
  require_partner_account: boolean;
  require_emergency_contact: boolean;
  require_full_address: boolean;
  allow_same_format_multiple: boolean;
  allow_player_score_entry: boolean;
  score_auto_confirm_minutes: number;
  check_in_window_hours: number;
  require_match_ready_confirm: boolean;
  default_match_duration: number;
  court_transition_minutes: number;
  auto_email_on_register: boolean;
  auto_email_on_payment: boolean;
  auto_email_court_assignment: boolean;
  sms_enabled: boolean;
  age_determination_date: string | null;
}

interface TournamentSettingsPanelProps {
  eventId: string;
}

const defaultSettings: Omit<EventSettings, 'id' | 'event_id'> = {
  max_events_per_player: 3,
  max_events_per_day: null,
  require_partner_account: false,
  require_emergency_contact: true,
  require_full_address: false,
  allow_same_format_multiple: false,
  allow_player_score_entry: false,
  score_auto_confirm_minutes: 3,
  check_in_window_hours: 1,
  require_match_ready_confirm: false,
  default_match_duration: 30,
  court_transition_minutes: 5,
  auto_email_on_register: true,
  auto_email_on_payment: true,
  auto_email_court_assignment: false,
  sms_enabled: false,
  age_determination_date: null,
};

export function TournamentSettingsPanel({ eventId }: TournamentSettingsPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EventSettings>({ ...defaultSettings, event_id: eventId });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [eventId]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_event_settings")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching settings:", error);
    } else if (data) {
      setSettings(data);
    } else {
      setSettings({ ...defaultSettings, event_id: eventId });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    const { id, ...settingsData } = settings;
    
    if (id) {
      const { error } = await supabase
        .from("tournament_event_settings")
        .update(settingsData)
        .eq("id", id);

      if (error) {
        toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Settings saved", description: "Tournament settings have been updated" });
        setHasChanges(false);
      }
    } else {
      const { error } = await supabase
        .from("tournament_event_settings")
        .insert(settingsData);

      if (error) {
        toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Settings saved", description: "Tournament settings have been created" });
        setHasChanges(false);
        fetchSettings();
      }
    }
    setSaving(false);
  };

  const updateSetting = <K extends keyof EventSettings>(key: K, value: EventSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tournament Settings</h2>
          <p className="text-muted-foreground">Configure advanced tournament options</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="registration" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="registration">Registration</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="registration" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registration Limits</CardTitle>
              <CardDescription>Control how many events players can register for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Events Per Player</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.max_events_per_player}
                    onChange={(e) => updateSetting("max_events_per_player", parseInt(e.target.value) || 3)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum divisions a player can enter
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max Events Per Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.max_events_per_day || ""}
                    onChange={(e) => updateSetting("max_events_per_day", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="No limit"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for no daily limit
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Partner Requirements</CardTitle>
              <CardDescription>Configure partner and team registration rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Partner Account</Label>
                  <p className="text-sm text-muted-foreground">
                    Partners must have a PULSE account to be added
                  </p>
                </div>
                <Switch
                  checked={settings.require_partner_account}
                  onCheckedChange={(checked) => updateSetting("require_partner_account", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Multiple Same-Format Entries</Label>
                  <p className="text-sm text-muted-foreground">
                    Let players enter multiple divisions with the same format
                  </p>
                </div>
                <Switch
                  checked={settings.allow_same_format_multiple}
                  onCheckedChange={(checked) => updateSetting("allow_same_format_multiple", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Required Information</CardTitle>
              <CardDescription>What players must provide during registration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Emergency Contact Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Players must provide an emergency contact
                  </p>
                </div>
                <Switch
                  checked={settings.require_emergency_contact}
                  onCheckedChange={(checked) => updateSetting("require_emergency_contact", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Full Address Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Collect complete mailing address
                  </p>
                </div>
                <Switch
                  checked={settings.require_full_address}
                  onCheckedChange={(checked) => updateSetting("require_full_address", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Age Determination</CardTitle>
              <CardDescription>Set the date used to calculate player ages for age-restricted divisions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Age Determination Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !settings.age_determination_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {settings.age_determination_date 
                        ? format(new Date(settings.age_determination_date), "PPP") 
                        : "Default: Dec 31 of tournament year"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={settings.age_determination_date ? new Date(settings.age_determination_date) : undefined}
                      onSelect={(date) => updateSetting("age_determination_date", date?.toISOString() || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Standard is Dec 31 of tournament year (USAP guidelines)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Match Timing</CardTitle>
              <CardDescription>Configure default match durations for scheduling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Match Duration (minutes)</Label>
                  <Select
                    value={settings.default_match_duration.toString()}
                    onValueChange={(val) => updateSetting("default_match_duration", parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="20">20 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Court Transition Time (minutes)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.court_transition_minutes}
                    onChange={(e) => updateSetting("court_transition_minutes", parseInt(e.target.value) || 5)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Buffer between matches on same court
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Check-in Settings</CardTitle>
              <CardDescription>Configure player check-in requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Check-in Window (hours before event)</Label>
                <Input
                  type="number"
                  min="0"
                  max="24"
                  value={settings.check_in_window_hours}
                  onChange={(e) => updateSetting("check_in_window_hours", parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  How early players can check in before their first match
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Match-Ready Confirmation</Label>
                  <p className="text-sm text-muted-foreground">
                    Players must confirm they're ready before each match
                  </p>
                </div>
                <Switch
                  checked={settings.require_match_ready_confirm}
                  onCheckedChange={(checked) => updateSetting("require_match_ready_confirm", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Player Score Entry</CardTitle>
              <CardDescription>Allow players to submit their own match scores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Player Score Entry</Label>
                  <p className="text-sm text-muted-foreground">
                    Winners can report scores from their phone
                  </p>
                </div>
                <Switch
                  checked={settings.allow_player_score_entry}
                  onCheckedChange={(checked) => updateSetting("allow_player_score_entry", checked)}
                />
              </div>
              
              {settings.allow_player_score_entry && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Auto-Confirm Timer (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.score_auto_confirm_minutes}
                    onChange={(e) => updateSetting("score_auto_confirm_minutes", parseInt(e.target.value) || 3)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Score is auto-confirmed if opponent doesn't respond within this time
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Configure automated email communications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Registration Confirmation</Label>
                  <p className="text-sm text-muted-foreground">
                    Email players when they register
                  </p>
                </div>
                <Switch
                  checked={settings.auto_email_on_register}
                  onCheckedChange={(checked) => updateSetting("auto_email_on_register", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Payment Confirmation</Label>
                  <p className="text-sm text-muted-foreground">
                    Email receipt when payment is processed
                  </p>
                </div>
                <Switch
                  checked={settings.auto_email_on_payment}
                  onCheckedChange={(checked) => updateSetting("auto_email_on_payment", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Court Assignment Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Email players when their match court is assigned
                  </p>
                </div>
                <Switch
                  checked={settings.auto_email_court_assignment}
                  onCheckedChange={(checked) => updateSetting("auto_email_court_assignment", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMS Notifications</CardTitle>
              <CardDescription>Text message notifications (premium feature)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable SMS</Label>
                  <p className="text-sm text-muted-foreground">
                    Send match reminders via text message
                  </p>
                </div>
                <Switch
                  checked={settings.sms_enabled}
                  onCheckedChange={(checked) => updateSetting("sms_enabled", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
