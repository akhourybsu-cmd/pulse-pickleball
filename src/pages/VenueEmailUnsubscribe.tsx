import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function VenueEmailUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  return <UnsubscribeConfirmation key={token} token={token} />;
}
function UnsubscribeConfirmation({ token }: { token: string }) {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const valid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      token,
    );
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <section className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-7">
        {done ? (
          <CheckCircle2 className="h-8 w-8 text-primary" />
        ) : (
          <Mail className="h-8 w-8 text-primary" />
        )}
        <h1 className="text-2xl font-semibold">
          {done ? "You’re unsubscribed" : "Venue email preferences"}
        </h1>
        {done ? (
          <p role="status" className="text-sm leading-6 text-muted-foreground">
            You won’t receive email updates from this venue. You can subscribe
            again in the venue’s notification settings.
          </p>
        ) : !valid ? (
          <p role="alert" className="text-sm">
            This link is invalid. Open the unsubscribe link from your venue
            email.
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Stop receiving email updates from this venue. Your bookings and
              other venues’ preferences stay the same.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="min-h-11 w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await supabase.functions.invoke(
                    "venue-email-unsubscribe",
                    { body: { token } },
                  );
                  if (result.error || result.data?.success !== true)
                    throw new Error("Preference update failed");
                  setDone(true);
                } catch {
                  setError(
                    "We couldn’t save your preference. Try again, or update Notifications on the venue page.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Unsubscribe from this venue"}
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
