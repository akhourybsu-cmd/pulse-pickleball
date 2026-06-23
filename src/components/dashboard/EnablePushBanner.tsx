import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_DISMISS_KEY = "pulse.enablePushBanner.dismissedAt";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches
  );
}

interface EnablePushBannerProps {
  dismissKey?: string;
  contextLabel?: string;
}

export function EnablePushBanner({ dismissKey, contextLabel }: EnablePushBannerProps = {}) {
  const navigate = useNavigate();
  const { state, busy, supported, enable } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);
  const storageKey = dismissKey || DEFAULT_DISMISS_KEY;

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return setDismissed(false);
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > DISMISS_TTL_MS) {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;
  if (state === "loading" || state === "enabled") return null;

  const iosNeedsInstall = isIOS() && !isStandalone();

  const dismiss = () => {
    localStorage.setItem(storageKey, String(Date.now()));
    setDismissed(true);
  };

  const handleEnable = async () => {
    await enable();
    // Best-effort: fire a confirming test push through the authenticated
    // self-test function. The internal push dispatcher requires a backend-only
    // secret, so it cannot be called directly from the browser.
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { data, error } = await supabase.functions.invoke("send-test-push", {
          body: { endpoint: sub.endpoint },
        });
        if (error || (data?.sent ?? 0) === 0) {
          toast.success("Notifications enabled.");
          return;
        }
        toast.success("Notifications enabled — check for a test push!");
      }
    } catch (e) {
      console.error("test push failed", e);
      toast.success("Notifications enabled.");
    }
  };

  let title = "Turn on notifications";
  let body = contextLabel
    ? `Get pinged when there's new activity in ${contextLabel}.`
    : "Get pinged for new posts, friend requests, and messages.";
  let action: React.ReactNode = (
    <Button size="sm" onClick={handleEnable} disabled={busy || !supported}>
      Enable
    </Button>
  );

  if (!supported) {
    title = "Notifications not supported";
    body = "Your browser doesn't support push notifications.";
    action = null;
  } else if (state === "denied") {
    title = "Notifications are blocked";
    body = "Enable notifications for PULSE in your browser settings.";
    action = (
      <Button size="sm" variant="outline" onClick={() => navigate("/settings/notifications")}>
        Settings
      </Button>
    );
  } else if (iosNeedsInstall) {
    title = "Install PULSE to get notifications";
    body = "On iPhone, tap Share → Add to Home Screen, then open PULSE from your home screen.";
    action = null;
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-start gap-3">
      <div className="rounded-full bg-primary/20 p-2 shrink-0">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
        {action && <div className="mt-3 flex gap-2">{action}
          <Button size="sm" variant="ghost" onClick={() => navigate("/settings/notifications")}>
            Manage
          </Button>
        </div>}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
