import { useRef, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuthState } from "@/hooks/useAuthState";
import { sendAuthEmail } from "@/lib/authEmail";
import { withAuthDeadline } from "@/lib/authDeadline";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export function PasswordSettings() {
  const { user } = useAuthState();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  const reset = async () => {
    if (!user?.email || lock.current) return;
    lock.current = true;
    setSending(true);
    try {
      await withAuthDeadline(() =>
        sendAuthEmail({
          type: "recovery",
          email: user.email!,
          redirectTo: `${window.location.origin}/reset-password`,
        })
      );
      setSent(true);
      toast.success("Password reset email sent. Check your inbox.");
    } catch {
      toast.error(
        "Could not confirm the reset email. Check your inbox before trying again."
      );
    } finally {
      lock.current = false;
      setSending(false);
    }
  };
  return (
    <Card data-account-card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Password
        </CardTitle>
        <CardDescription className="break-words">
          Send a secure reset link to {user?.email || "your account email"}.
        </CardDescription>
      </CardHeader>
      <CardContent data-account-content className="space-y-3">
        <Button
          variant="outline"
          disabled={!user?.email || sending}
          onClick={() => void reset()}
        >
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {sending
            ? "Sending…"
            : sent
            ? "Send another reset link"
            : "Send password reset link"}
        </Button>
        {sent && (
          <p role="status" className="text-sm text-muted-foreground">
            Check your inbox to choose a new password.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
