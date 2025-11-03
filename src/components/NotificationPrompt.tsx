import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useState, useEffect } from "react";

export function NotificationPrompt() {
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show prompt if notifications are supported but not granted
    if (isSupported && permission === 'default' && !dismissed) {
      // Delay showing the prompt a bit so it's not intrusive on first load
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, dismissed]);

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('notification-prompt-dismissed', 'true');
  };

  const handleSubscribe = async () => {
    await subscribe();
    setShowPrompt(false);
  };

  // Don't show if not supported or already handled
  if (!isSupported || permission === 'granted' || permission === 'denied' || !showPrompt) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 p-4 max-w-sm shadow-lg animate-in slide-in-from-bottom-5">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3 pr-6">
        <div className="p-2 bg-primary/10 rounded-full">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Enable Notifications</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Get notified about match invites, court updates, and tournament announcements
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSubscribe} size="sm">
              Enable
            </Button>
            <Button onClick={handleDismiss} size="sm" variant="outline">
              Not now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function NotificationToggle() {
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        Push notifications not supported on this browser
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="text-sm text-muted-foreground">
        Notifications blocked. Enable them in your browser settings.
      </div>
    );
  }

  return (
    <Button
      onClick={isSubscribed ? unsubscribe : subscribe}
      variant={isSubscribed ? "outline" : "default"}
      className="gap-2"
    >
      {isSubscribed ? (
        <>
          <BellOff className="w-4 h-4" />
          Disable Notifications
        </>
      ) : (
        <>
          <Bell className="w-4 h-4" />
          Enable Notifications
        </>
      )}
    </Button>
  );
}
