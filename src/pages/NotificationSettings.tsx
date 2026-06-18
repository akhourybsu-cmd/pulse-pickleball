import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Bell, BellRing, Target, Calendar, Users, Trophy, Settings, Loader2 } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Skeleton } from "@/components/ui/skeleton";

const categoryConfig = [
  { id: "matches", label: "Matches", description: "Match recordings, verifications, and results", icon: Target },
  { id: "events", label: "Events", description: "Event reminders and registration updates", icon: Calendar },
  { id: "community", label: "Community", description: "Group posts, comments, and LFG alerts", icon: Users },
  { id: "achievements", label: "Achievements", description: "Badges earned and milestones reached", icon: Trophy },
  { id: "system", label: "System", description: "Account updates and announcements", icon: Settings },
];

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const { preferences, loading, updatePreference, isEnabled } = useNotificationPreferences(userId);
  const push = usePushSubscription();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Notification Settings</h1>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">
          Control which notifications you receive in the app.
        </p>

        {/* Browser push — gates the OS-level notification. Independent of
            per-category in-app toggles below: a category needs to be
            ON *and* push to be enabled for a notification to leave the
            browser tab. */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {push.enabled ? (
                    <BellRing className="h-5 w-5 text-primary" />
                  ) : (
                    <Bell className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">Browser notifications</CardTitle>
                  <CardDescription className="text-xs">
                    {!push.supported
                      ? 'Not available in this browser yet'
                      : push.permission === 'denied'
                        ? 'Blocked by browser — open site permissions to re-enable'
                        : push.enabled
                          ? 'Receiving push for the categories below'
                          : 'Enable to get pings when the app is closed'}
                  </CardDescription>
                </div>
              </div>
              {push.loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={push.enabled}
                  disabled={!push.supported || push.permission === 'denied'}
                  onCheckedChange={(v) => (v ? push.enable() : push.disable())}
                />
              )}
            </div>
          </CardHeader>
        </Card>

        {categoryConfig.map((cat) => {
          const Icon = cat.icon;
          const enabled = isEnabled(cat.id);

          return (
            <Card key={cat.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{cat.label}</CardTitle>
                      <CardDescription className="text-xs">{cat.description}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => updatePreference(cat.id, { in_app_enabled: checked })}
                  />
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
