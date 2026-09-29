import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useAuthState } from "@/hooks/useAuthState";
import { venueRpc } from "@/lib/venues/customerRecords";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
type Preference = { subscribed: boolean; global_enabled: boolean } | null;
export function VenueEmailPreference({ groupId }: { groupId: string }) {
  const { user } = useAuthState();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["venue-email-preference", groupId, user?.id],
    enabled: !!user,
    queryFn: () =>
      venueRpc<Preference>("venue_email_preference", { p_group: groupId }),
  });
  if (q.isError)
    return (
      <div role="alert" className="p-4 text-sm">
        Email preferences couldn’t load.{" "}
        <Button variant="ghost" onClick={() => void q.refetch()}>
          Retry
        </Button>
      </div>
    );
  if (!q.data) return null;
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <Mail className="mt-1 h-4 w-4 shrink-0" />
          <div>
            <p id="venue-email-opt-in" className="text-sm font-medium">
              Venue email updates
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Receive branded news and event updates in your account inbox.
              Unsubscribe any time. Off until you choose to subscribe.
            </p>
          </div>
        </div>
        <Switch
          aria-labelledby="venue-email-opt-in"
          checked={q.data.subscribed}
          disabled={busy}
          onCheckedChange={async (subscribed) => {
            setBusy(true);
            setError("");
            try {
              await venueRpc("venue_email_preference", {
                p_group: groupId,
                p_subscribed: subscribed,
              });
              await q.refetch();
            } catch {
              setError("Your preference could not be saved. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {!q.data.global_enabled && (
        <p className="text-xs text-muted-foreground">
          Community email is turned off in your account notification settings.
          Enable it there to receive these updates.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
