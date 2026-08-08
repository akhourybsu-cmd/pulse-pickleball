import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestPushResult {
  deviceTokens: number;
  sent: number;
  diagnosis: string;
  target_user_id: string;
}

/**
 * Admin tool: fire a native (FCM) test push to your own devices — or to a
 * specific user id — and see diagnostics (how many device tokens are
 * registered and how many FCM messages were accepted). Use this to verify the
 * native push pipeline without waiting on a real event.
 */
export function TestPushCard() {
  const [targetUserId, setTargetUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestPushResult | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const body = targetUserId.trim() ? { target_user_id: targetUserId.trim() } : {};
      const { data, error } = await supabase.functions.invoke("admin-test-push", { body });
      if (error) {
        toast.error(`Test push failed: ${error.message}`);
        return;
      }
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }
      setResult(data as TestPushResult);
      if (data.sent > 0) toast.success(`Push sent to ${data.sent} device(s).`);
      else toast.warning("No push delivered — see the diagnosis below.");
    } catch (e) {
      toast.error(`Test push error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          Native push test
        </CardTitle>
        <CardDescription>
          Send a test push through the FCM pipeline and see how many device tokens are
          registered and how many messages were accepted. Leave the field blank to send to
          your own devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="test-push-target" className="text-xs">
            Target user id (optional — defaults to you)
          </Label>
          <Input
            id="test-push-target"
            placeholder="Your own devices"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        <Button onClick={send} disabled={busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
          {busy ? "Sending…" : "Send test push"}
        </Button>

        {result && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex gap-4">
              <span className="text-muted-foreground">Device tokens:</span>
              <span className="font-semibold">{result.deviceTokens}</span>
              <span className="text-muted-foreground">Sent:</span>
              <span className="font-semibold">{result.sent}</span>
            </div>
            <p className="text-xs text-muted-foreground">{result.diagnosis}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
