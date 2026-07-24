import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Bell, BellRing, Target, Calendar, Users, Trophy, Settings, MessageCircle, Shield, ChevronRight, Send, Loader2 } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useMessagingPrivacy } from "@/hooks/useMessagingSafety";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const categoryConfig = [
  { id: "matches", label: "Matches", description: "Match recordings, verifications, and results", icon: Target },
  { id: "leagues", label: "Leagues", description: "Score confirmations, disputes, forfeits, and resolved matches", icon: Trophy },
  { id: "events", label: "Events", description: "Event reminders and registration updates", icon: Calendar },
  { id: "community", label: "Community", description: "Group posts, comments, and LFG alerts", icon: Users },
  { id: "achievements", label: "Achievements", description: "Badges earned and milestones reached", icon: Shield },
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

        <BrowserPushCard />
        <TestNotificationCard />

        <MessagingPrivacyCard />
        <BlockedUsersLinkCard onClick={() => navigate('/settings/blocked')} />





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

function BrowserPushCard() {
  const { state, busy, supported, enable, disable } = usePushSubscription();
  const enabled = state === "enabled";
  const disabledControl = busy || state === "loading" || state === "unsupported" || state === "denied";

  let helper = "Get notified on your phone or device even when the app is closed. On iPhone, add this app to your Home Screen first (Share → Add to Home Screen).";
  if (state === "unsupported") helper = "Your browser doesn't support push notifications. On iPhone, open this site in Safari and add it to your Home Screen.";
  else if (state === "denied") helper = "Notifications are blocked. Enable them in your device's settings for this app.";
  else if (state === "enabled") helper = "Mobile push notifications are on for this device.";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BellRing className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Mobile push notifications</CardTitle>
              <CardDescription className="text-xs">{helper}</CardDescription>
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={disabledControl}
            onCheckedChange={(checked) => (checked ? enable() : disable())}
          />
        </div>
      </CardHeader>
    </Card>
  );
}

function isLovablePreviewContext() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  const previewHost =
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev");
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  return previewHost || inIframe;
}

function TestNotificationCard() {
  const { state, supported, enable, busy: pushBusy } = usePushSubscription();
  const [sending, setSending] = useState(false);
  const isPreview = isLovablePreviewContext();

  const handleSend = async () => {
    if (isPreview) {
      toast.error("Push notifications are disabled in the app preview. Open the published app to test.");
      return;
    }
    if (!supported) {
      toast.error("Notifications are not supported in this browser.");
      return;
    }
    if (state === "denied") {
      toast.error("Notifications are blocked. Enable them in your device/browser settings.");
      return;
    }
    setSending(true);
    try {
      // Ensure push permission + subscription on this device
      if (state !== "enabled") {
        toast.message("Enabling notifications on this device…");
        await enable();
        if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
          toast.error("Notifications are not enabled for this device.");
          setSending(false);
          return;
        }
      }

      // Wait for the service worker, with a timeout so we never hang
      const reg = await Promise.race<ServiceWorkerRegistration | null>([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (!reg) {
        toast.error("Service worker isn't ready on this device. Reload the app and try again.");
        setSending(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        toast.error("This device is not registered for notifications. Toggle Mobile push notifications off and on again.");
        setSending(false);
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("You must be signed in.");
        setSending(false);
        return;
      }

      // Make sure this device's subscription is recorded server-side
      const j = sub.toJSON() as any;
      const { error: upsertErr } = await supabase.from("push_subscriptions").upsert({
        user_id: u.user.id,
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh ?? "",
        auth: j.keys?.auth ?? "",
        user_agent: navigator.userAgent,
      }, { onConflict: "endpoint" });
      if (upsertErr) {
        console.error("[send-test-push] upsert sub failed", upsertErr);
        toast.error(`Couldn't register this device: ${upsertErr.message}`);
        setSending(false);
        return;
      }


      const { data, error } = await supabase.functions.invoke("send-test-push", {
        body: { endpoint: sub.endpoint },
      });
      console.log("[send-test-push] response", { data, error });

      // supabase-js puts the parsed body on error.context for non-2xx
      let payload: any = data;
      if (error && !payload) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") payload = await ctx.json();
        } catch (_) { /* ignore */ }
      }
      const code = payload?.error;

      if (code === "no_subscriptions") {
        toast.error("This device isn't registered yet. Toggle Mobile push notifications off and on, then try again.");
      } else if (code === "push_not_configured") {
        toast.error("Push isn't configured on the server (missing VAPID keys).");
      } else if (code === "unauthorized") {
        toast.error("Your session expired. Sign in again and retry.");
      } else if (error) {
        console.error("send-test-push error", error);
        toast.error(`Could not send test notification: ${error.message || "unknown error"}`);
      } else if ((payload?.sent ?? 0) === 0) {
        toast.error("Server accepted the request but the device didn't receive it. Try re-enabling notifications.");
      } else {
        toast.success("Test notification sent. Check your device.");
      }
    } catch (e: any) {
      console.error("test push failed", e);
      toast.error(`Could not send test notification: ${e?.message || "unknown error"}`);
    } finally {
      setSending(false);
    }
  };


  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Send Test Notification</CardTitle>
              <CardDescription className="text-xs">
                Send a test push to this device to confirm notifications are working.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleSend}
          disabled={sending || pushBusy || !supported || isPreview}
          className="w-full"
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending test notification…</>
          ) : (
            <><Send className="h-4 w-4 mr-2" /> Send Test Notification</>
          )}
        </Button>
        {isPreview && (
          <p className="text-xs text-muted-foreground mt-2">
            Push notifications are disabled in the app preview. Open your published app on the device to run this test.
          </p>
        )}
        {!isPreview && state === "denied" && (
          <p className="text-xs text-destructive mt-2">
            Notifications are blocked. Enable them in your device/browser settings.
          </p>
        )}
        {!isPreview && !supported && (
          <p className="text-xs text-muted-foreground mt-2">
            This browser doesn't support web push notifications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}


function MessagingPrivacyCard() {
  const { privacy, loading, update } = useMessagingPrivacy();
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Who can message me</CardTitle>
            <CardDescription className="text-xs">Controls who can start a direct message with you.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={privacy}
          onValueChange={(v) => update(v as any)}
          disabled={loading}
          className="space-y-2"
        >
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <RadioGroupItem value="friends" id="dm-friends" />
            <Label htmlFor="dm-friends" className="flex-1 cursor-pointer">
              <div className="text-sm font-medium">Friends only</div>
              <div className="text-xs text-muted-foreground">Recommended. Only approved friends can DM you.</div>
            </Label>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <RadioGroupItem value="nobody" id="dm-nobody" />
            <Label htmlFor="dm-nobody" className="flex-1 cursor-pointer">
              <div className="text-sm font-medium">Nobody</div>
              <div className="text-xs text-muted-foreground">No one can start a new DM with you. Existing threads stay visible.</div>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

function BlockedUsersLinkCard({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left">
      <Card className="hover:bg-muted/30 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Blocked users</CardTitle>
                <CardDescription className="text-xs">Manage who you've blocked.</CardDescription>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
      </Card>
    </button>
  );
}

