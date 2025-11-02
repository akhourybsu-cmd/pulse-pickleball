import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, X } from "lucide-react";
import { MFAEnrollment } from "./MFAEnrollment";

export const MFAPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkIfShouldPrompt();
  }, []);

  const checkIfShouldPrompt = async () => {
    try {
      // Check if user already dismissed the prompt recently
      const dismissedUntil = localStorage.getItem("mfa-prompt-dismissed-until");
      if (dismissedUntil) {
        const dismissedTime = new Date(dismissedUntil).getTime();
        if (Date.now() < dismissedTime) {
          setDismissed(true);
          return;
        } else {
          // Clear expired dismissal
          localStorage.removeItem("mfa-prompt-dismissed-until");
        }
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const hasActiveFactor = data.totp.some((factor) => factor.status === "verified");
      if (!hasActiveFactor) {
        setShowPrompt(true);
      }
    } catch (error) {
      console.error("Error checking MFA status:", error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
  };

  const handleSetupLater = () => {
    // Set dismissal for 24 hours
    const dismissUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    localStorage.setItem("mfa-prompt-dismissed-until", dismissUntil.toISOString());
    handleDismiss();
  };

  const handleEnableNow = () => {
    setShowEnrollment(true);
  };

  const handleEnrollmentComplete = () => {
    setShowPrompt(false);
    setDismissed(true);
  };

  if (dismissed || !showPrompt) {
    return null;
  }

  return (
    <>
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="relative pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Secure Your Account with MFA
          </CardTitle>
          <CardDescription>
            Enable two-factor authentication for enhanced security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Protect your account by requiring a verification code from your authenticator app in addition to your password.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleEnableNow} className="flex-1">
              Enable Now
            </Button>
            <Button variant="outline" onClick={handleSetupLater} className="flex-1">
              Maybe Later
            </Button>
          </div>
        </CardContent>
      </Card>

      <MFAEnrollment
        open={showEnrollment}
        onOpenChange={setShowEnrollment}
        onEnrollmentComplete={handleEnrollmentComplete}
      />
    </>
  );
};
