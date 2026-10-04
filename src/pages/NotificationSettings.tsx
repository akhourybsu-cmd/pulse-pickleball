import { withAuthDeadline } from "@/lib/authDeadline";
import { AccountPageHeader } from "@/components/profile/AccountPageHeader";
import { useAuthState } from "@/hooks/useAuthState";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bell,
  BellRing,
  Target,
  Calendar,
  Users,
  Trophy,
  Settings,
  MessageCircle,
  Shield,
  ChevronRight,
  Send,
  Loader2,
} from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useMessagingPrivacy } from "@/hooks/useMessagingSafety";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const categoryConfig = [
  {
    id: "matches",
    label: "Matches",
    description: "Match recordings, verifications, and results",
    icon: Target,
  },
  {
    id: "leagues",
    label: "Leagues",
    description:
      "Score confirmations, disputes, forfeits, and resolved matches",
    icon: Trophy,
  },
  {
    id: "events",
    label: "Events",
    description: "Event reminders and registration updates",
    icon: Calendar,
  },
  {
    id: "messages",
    label: "Messages",
    description: "Direct messages and group chat activity",
    icon: MessageCircle,
  },
  {
    id: "community",
    label: "Community",
    description: "Group posts, comments, and LFG alerts",
    icon: Users,
  },
  {
    id: "achievements",
    label: "Achievements",
    description: "Badges earned and milestones reached",
    icon: Shield,
  },
  {
    id: "system",
    label: "System",
    description: "Account updates and announcements",
    icon: Settings,
  },
];

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuthState();
  const push = usePushSubscription();
  const { loading, saving, error, refetch, updatePreference, isEnabled } =
    useNotificationPreferences(user?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
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
      <AccountPageHeader
        icon={Bell}
        title="Notifications & privacy"
        subtitle="Choose your alerts and who can reach you."
      />

      <div className="account-settings-content">
        <section aria-labelledby="device-alerts-heading">
          <h2 id="device-alerts-heading" className="account-section-label">
            On this device
          </h2>
          <BrowserPushCard push={push} />
        </section>

        <section aria-labelledby="messaging-heading">
          <h2 id="messaging-heading" className="account-section-label">
            Messages & privacy
          </h2>
          <div className="space-y-3">
            <MessagingPrivacyCard />
            <BlockedUsersLinkCard
              onClick={() => navigate("/player/profile/blocked")}
            />
          </div>
        </section>

        <section aria-labelledby="in-app-heading">
          <h2 id="in-app-heading" className="account-section-label">
            In-app notifications
          </h2>
          {error && (
            <p role="alert" className="rounded-xl border p-4 text-sm">
              Couldn’t load your notification preferences.{" "}
              <Button variant="link" onClick={() => void refetch()}>
                Try again
              </Button>
            </p>
          )}
          <Card data-account-card className="divide-y divide-border/40">
            {categoryConfig.map((cat) => {
              const Icon = cat.icon;
              const enabled = isEnabled(cat.id);

              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-4 p-4 sm:px-6"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="account-setting-icon">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{cat.label}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {cat.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={saving || error || !user}
                    aria-label={cat.label + " notifications"}
                    onCheckedChange={(checked) =>
                      updatePreference(cat.id, { in_app_enabled: checked })
                    }
                  />
                </div>
              );
            })}
          </Card>
        </section>
        <TestNotificationCard push={push} />
      </div>
    </div>
  );
}

function BrowserPushCard({
  push,
}: {
  push: ReturnType<typeof usePushSubscription>;
}) {
  const { state, busy, enable, disable, error, refresh } = push;
  const enabled = state === "enabled";
  const disabledControl =
    busy ||
    state === "loading" ||
    state === "unsupported" ||
    state === "denied";

  let helper =
    "Get notified on your phone or device even when the app is closed. On iPhone, add this app to your Home Screen first (Share → Add to Home Screen).";
  if (state === "unsupported")
    helper =
      "Your browser doesn't support push notifications. On iPhone, open this site in Safari and add it to your Home Screen.";
  else if (state === "denied")
    helper =
      "Notifications are blocked. Enable them in your device's settings for this app.";
  else if (state === "enabled")
    helper = "Mobile push notifications are on for this device.";

  return (
    <Card data-account-card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="account-setting-icon">
              <BellRing className="h-[18px] w-[18px]" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">
                Mobile push notifications
              </CardTitle>
              {error && (
                <p role="alert" className="text-xs">
                  {error}{" "}
                  <Button variant="link" onClick={() => void refresh()}>
                    Try again
                  </Button>
                </p>
              )}
              <CardDescription className="mt-1 text-xs leading-relaxed">
                {helper}
              </CardDescription>
            </div>
          </div>
          <Switch
            aria-label="Mobile push notifications"
            checked={enabled}
            disabled={disabledControl}
            onCheckedChange={(checked) => {
              void (checked ? enable() : disable());
            }}
          />
        </div>
      </CardHeader>
    </Card>
  );
}

function isEmbeddedPreviewContext() {
  if (typeof window === "undefined") return false;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  return inIframe;
}

function TestNotificationCard({
  push,
}: {
  push: ReturnType<typeof usePushSubscription>;
}) {
  const { state, supported, enable, busy: pushBusy } = push;
  const { user } = useAuthState();
  const sendingLock = useRef(false);
  const [sending, setSending] = useState(false);
  const isPreview = isEmbeddedPreviewContext();

  const handleSend = async () => {
    if (isPreview) {
      toast.error(
        "Push notifications are disabled in the app preview. Open the published app to test."
      );
      return;
    }
    if (!supported) {
      toast.error("Notifications are not supported in this browser.");
      return;
    }
    if (state === "denied") {
      toast.error(
        "Notifications are blocked. Enable them in your device/browser settings."
      );
      return;
    }
    if (sendingLock.current || !user) return;
    sendingLock.current = true;
    setSending(true);
    try {
      // Ensure push permission + subscription on this device
      if (state !== "enabled") {
        toast.message("Enabling notifications on this device…");
        if (!(await enable())) return;
        if (
          typeof Notification !== "undefined" &&
          Notification.permission !== "granted"
        ) {
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
        toast.error(
          "Service worker isn't ready on this device. Reload the app and try again."
        );
        setSending(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        toast.error(
          "This device is not registered for notifications. Toggle Mobile push notifications off and on again."
        );
        setSending(false);
        return;
      }

      // Make sure this device's subscription is recorded server-side
      const j = sub.toJSON() as any;
      const { error: upsertErr } = await withAuthDeadline((signal) =>
        supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              endpoint: sub.endpoint,
              p256dh: j.keys?.p256dh ?? "",
              auth: j.keys?.auth ?? "",
              user_agent: navigator.userAgent,
            },
            { onConflict: "endpoint" }
          )
          .abortSignal(signal)
      );
      if (upsertErr) {
        console.error("[send-test-push] upsert sub failed", upsertErr);
        toast.error(`Couldn't register this device: ${upsertErr.message}`);
        setSending(false);
        return;
      }

      const { data, error } = await withAuthDeadline((signal) =>
        supabase.functions.invoke("send-test-push", {
          signal,
          body: { endpoint: sub.endpoint },
        })
      );

      // supabase-js puts the parsed body on error.context for non-2xx
      let payload: any = data;
      if (error && !payload) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") payload = await ctx.json();
        } catch (_) {
          /* ignore */
        }
      }
      const code = payload?.error;

      if (code === "no_subscriptions") {
        toast.error(
          "This device isn't registered yet. Toggle Mobile push notifications off and on, then try again."
        );
      } else if (code === "push_not_configured") {
        toast.error(
          "Push isn't configured on the server (missing VAPID keys)."
        );
      } else if (code === "unauthorized") {
        toast.error("Your session expired. Sign in again and retry.");
      } else if (error) {
        console.error("send-test-push error", error);
        toast.error(
          `Could not send test notification: ${
            error.message || "unknown error"
          }`
        );
      } else if ((payload?.sent ?? 0) === 0) {
        toast.error(
          "Server accepted the request but the device didn't receive it. Try re-enabling notifications."
        );
      } else {
        toast.success("Test notification sent. Check your device.");
      }
    } catch (e: any) {
      console.error("test push failed", e);
      toast.error(
        `Could not send test notification: ${e?.message || "unknown error"}`
      );
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  };

  return (
    <Card data-account-card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="account-setting-icon">
              <Send className="h-[18px] w-[18px]" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">
                Send Test Notification
              </CardTitle>
              <CardDescription className="mt-1 text-xs leading-relaxed">
                Send a test push to this device to confirm notifications are
                working.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent data-account-content>
        <Button
          onClick={handleSend}
          disabled={sending || pushBusy || !supported || isPreview}
          className="w-full"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending test
              notification…
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" /> Send Test Notification
            </>
          )}
        </Button>
        {isPreview && (
          <p className="text-xs text-muted-foreground mt-2">
            Push notifications are disabled in the app preview. Open your
            published app on the device to run this test.
          </p>
        )}
        {!isPreview && state === "denied" && (
          <p className="text-xs text-destructive mt-2">
            Notifications are blocked. Enable them in your device/browser
            settings.
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
  const { privacy, loading, saving, error, refetch, update } =
    useMessagingPrivacy();
  return (
    <Card data-account-card>
      <CardHeader className="pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="account-setting-icon">
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-base">Who can message me</CardTitle>
            <CardDescription className="mt-1 text-xs leading-relaxed">
              Controls who can start a direct message with you.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent data-account-content>
        {error && (
          <p role="alert" className="mb-3 text-sm">
            Couldn’t load your messaging privacy.{" "}
            <Button variant="link" onClick={() => void refetch()}>
              Try again
            </Button>
          </p>
        )}
        <RadioGroup
          value={privacy}
          onValueChange={(v) => update(v as any)}
          disabled={loading || saving || error}
          className="gap-2"
        >
          <div className="account-privacy-option">
            <RadioGroupItem
              value="friends"
              id="dm-friends"
              className="mt-0.5"
            />
            <Label htmlFor="dm-friends" className="flex-1 cursor-pointer">
              <div className="text-sm font-medium">Friends only</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Recommended. Only approved friends can DM you.
              </div>
            </Label>
          </div>
          <div className="account-privacy-option">
            <RadioGroupItem value="nobody" id="dm-nobody" className="mt-0.5" />
            <Label htmlFor="dm-nobody" className="flex-1 cursor-pointer">
              <div className="text-sm font-medium">Nobody</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                No one can start a new DM with you. Existing threads stay
                visible.
              </div>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

function BlockedUsersLinkCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        data-account-card
        className="transition-colors group-hover:border-primary/40 group-hover:bg-muted/20"
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="account-setting-icon">
                <Shield className="h-[18px] w-[18px]" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-base">Blocked users</CardTitle>
                <CardDescription className="mt-1 text-xs leading-relaxed">
                  Manage who you've blocked.
                </CardDescription>
              </div>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </div>
        </CardHeader>
      </Card>
    </button>
  );
}
