import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { MFAEnrollment } from "./MFAEnrollment";
import { MFAMethodSelector } from "./MFAMethodSelector";
import { EmailMFAChallenge } from './EmailMFAChallenge';
import { confirmMfaSession, getMfaStatus } from '@/lib/mfa';
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
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "email" | "sms" | "none">("none");
  const [loading, setLoading] = useState(true);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showEmailEnrollment, setShowEmailEnrollment] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    setLoading(true);
    setStatusError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAccountEmail(user.email ?? '');
      const status = await getMfaStatus();
      const method = status.method;
      setMfaMethod(method as "authenticator" | "email" | "sms" | "none");
      setMfaEnabled(method !== "none");

    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not load security settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await confirmMfaSession();
      // Supabase requires aal2 for removing verified factors. Handle all of
      // them, and never announce a downgrade when an API operation failed.
      if (mfaMethod === "authenticator") {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;
        for (const factor of factors.all.filter(f => f.status === 'verified')) {
          const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (error) throw error;
        }
      }
      const { error: settingError } = await supabase.from('profiles').update({ mfa_method: 'none' }).eq('id', user.id);
      if (settingError) throw settingError;
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;

      toast.success("MFA has been disabled");
      setMfaEnabled(false);
      setMfaMethod("none");
      setShowDisableDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disable MFA");
    }
  };

  const handleMethodSelect = (method: "authenticator" | "email" | "sms") => {
    setShowMethodSelector(false);
    if (method === "authenticator") {
      setShowEnrollment(true);
    } else if (method === "email") {
      setShowEmailEnrollment(true);
    } else {
      toast.info("SMS MFA coming soon!");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sign-in protection
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
      {statusError && <p role="alert" className="p-4 text-sm text-destructive">{statusError} <Button variant="outline" onClick={() => void checkMFAStatus()}>Retry</Button></p>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mfaEnabled ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-yellow-600" />
            )}
            Sign-in protection
          </CardTitle>
          <CardDescription>
            {mfaEnabled
              ? "Verification is enabled for your PULSE data"
              : "Add an extra layer of security to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaEnabled ? (
            <>
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <ShieldCheck className="h-4 w-4" />
                MFA is enabled ({mfaMethod === "authenticator" ? "Authenticator App" : "Email Code"})
              </div>
              <p className="text-sm text-muted-foreground">
                {mfaMethod === 'email' ? 'Verify each new sign-in session using your account email. Verification is renewed after 12 hours.' : "You'll be asked for a verification code from your authenticator app when signing in."}
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
              <Button disabled={!!statusError} onClick={() => setShowMethodSelector(true)}>
                Enable MFA
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {showMethodSelector && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <MFAMethodSelector onSelectMethod={handleMethodSelect} />
          </CardContent>
        </Card>
      )}

      <MFAEnrollment
        open={showEnrollment}
        onOpenChange={setShowEnrollment}
        onEnrollmentComplete={checkMFAStatus}
      />
      <EmailMFAChallenge open={showEmailEnrollment} email={accountEmail} purpose="enroll"
        onCancel={() => setShowEmailEnrollment(false)}
        onSuccess={() => { setShowEmailEnrollment(false); toast.success('Email verification enabled for your account.'); void checkMFAStatus(); }} />

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
