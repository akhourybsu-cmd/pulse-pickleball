import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { logger } from "@/lib/logger";

interface EmailMFAChallengeProps {
  open: boolean;
  email: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EmailMFAChallenge = ({ open, email, onSuccess, onCancel }: EmailMFAChallengeProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const sendCode = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const { error } = await supabase.functions.invoke("send-mfa-code", {
        body: { email, method: "email" },
      });

      if (error) throw error;
      toast.success("Verification code sent to your email");
    } catch (error) {
      logger.error("Error sending code:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send verification code";
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-mfa-code", {
        body: { code, email },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Email verification successful!");
        setCode("");
        onSuccess();
      } else {
        throw new Error(data.error || "Verification failed");
      }
    } catch (error) {
      logger.error("Email MFA verification error:", error);
      const errorMessage = error instanceof Error ? error.message : "Invalid verification code";
      toast.error(errorMessage);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  // Send code when dialog opens
  const [hasSentInitialCode, setHasSentInitialCode] = useState(false);
  
  if (open && email && !hasSentInitialCode) {
    setHasSentInitialCode(true);
    sendCode();
  }
  
  if (!open && hasSentInitialCode) {
    setHasSentInitialCode(false);
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Verification
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit code sent to {email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-code">Verification Code</Label>
            <Input
              id="email-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-lg tracking-widest"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) {
                  handleVerify();
                }
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={sendCode}
              disabled={sending || loading}
              className="flex-1"
            >
              {sending ? "Sending..." : "Resend Code"}
            </Button>
            <Button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
