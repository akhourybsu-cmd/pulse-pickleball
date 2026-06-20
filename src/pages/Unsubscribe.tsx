import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "ready" | "already" | "invalid" | "submitting" | "success" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid === true) {
          setStatus("ready");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setStatus("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setStatus("error");
        return;
      }
      if (data?.success || data?.reason === "already_unsubscribed") {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-primary" />
          </div>
        </div>

        {status === "loading" && (
          <div className="text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Checking your link…</p>
          </div>
        )}

        {status === "ready" && (
          <div className="text-center space-y-5">
            <h1 className="text-2xl font-semibold">Unsubscribe from emails</h1>
            <p className="text-muted-foreground">
              You'll stop receiving non-essential emails from Pulse Pickleball. Account-critical
              messages (password resets, security alerts) will still be delivered.
            </p>
            <Button onClick={handleConfirm} className="w-full" size="lg">
              Confirm Unsubscribe
            </Button>
          </div>
        )}

        {status === "submitting" && (
          <div className="text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Processing…</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-2xl font-semibold">You're unsubscribed</h1>
            <p className="text-muted-foreground">
              You've been removed from our email list. Sorry to see you go.
            </p>
          </div>
        )}

        {status === "already" && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Already unsubscribed</h1>
            <p className="text-muted-foreground">
              This email address has already been removed from our list.
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-2xl font-semibold">Invalid link</h1>
            <p className="text-muted-foreground">
              This unsubscribe link is invalid or has expired. If you're still receiving unwanted
              email, reply to the latest message and we'll handle it.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground">
              Please try again in a moment.
            </p>
            <Button onClick={handleConfirm} variant="outline" className="w-full">
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
