import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { MFAEnrollment } from "./MFAEnrollment";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const MFAManagement = () => {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const hasActiveFactor = data.totp.some((factor) => factor.status === "verified");
      setMfaEnabled(hasActiveFactor);
      if (hasActiveFactor) {
        setFactorId(data.totp[0].id);
      }
    } catch (error: any) {
      console.error("Error checking MFA status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!factorId) return;

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (error) throw error;

      toast.success("MFA has been disabled");
      setMfaEnabled(false);
      setFactorId(null);
      setShowDisableDialog(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to disable MFA");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mfaEnabled ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-yellow-600" />
            )}
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            {mfaEnabled
              ? "Your account is protected with two-factor authentication"
              : "Add an extra layer of security to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaEnabled ? (
            <>
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <ShieldCheck className="h-4 w-4" />
                MFA is enabled
              </div>
              <p className="text-sm text-muted-foreground">
                You'll be asked for a verification code from your authenticator app when signing in.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDisableDialog(true)}
              >
                Disable MFA
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-yellow-600 font-medium">
                <ShieldAlert className="h-4 w-4" />
                MFA is not enabled
              </div>
              <p className="text-sm text-muted-foreground">
                Protect your account by requiring a verification code from your authenticator app in addition to your password.
              </p>
              <Button onClick={() => setShowEnrollment(true)}>
                Enable MFA
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <MFAEnrollment
        open={showEnrollment}
        onOpenChange={setShowEnrollment}
        onEnrollmentComplete={checkMFAStatus}
      />

      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reduce the security of your account. You'll only need your password to sign in.
              Are you sure you want to disable MFA?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisableMFA} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disable MFA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
