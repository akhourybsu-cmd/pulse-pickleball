import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LinkedAccounts } from "@/components/profile/LinkedAccounts";
import { MFAManagement } from "@/components/auth/MFAManagement";
import { BiometricSetup } from "@/components/auth/BiometricSetup";

/**
 * Profile → Security. Home for the account-hardening controls: two-factor
 * authentication, biometric sign-in, and linked Google/Apple accounts. The
 * login-side challenges (MFA / biometric prompts) live in the Auth flow; this
 * page is where users enroll and manage those methods.
 */
export default function SecuritySettings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Security</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <p className="text-sm text-muted-foreground">
          Protect your account with two-factor authentication and biometric
          sign-in, and manage the accounts you use to log in.
        </p>
        <MFAManagement />
        <BiometricSetup />
        <LinkedAccounts />
      </main>
    </div>
  );
}
