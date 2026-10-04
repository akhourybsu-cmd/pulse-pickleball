import { useAuthState } from '@/hooks/useAuthState';
import { AccountPageHeader } from '@/components/profile/AccountPageHeader';
import { PasswordSettings } from "@/components/profile/PasswordSettings";
import { ShieldCheck } from "lucide-react";
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
  const { user } = useAuthState();

  return (
    <div className="min-h-screen bg-background">
      <AccountPageHeader icon={ShieldCheck} title="Sign-in & security" subtitle="Manage your password and sign-in protection." />

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <p className="text-sm text-muted-foreground">
          Protect your account with two-factor authentication and biometric
          sign-in, and manage the accounts you use to log in.
        </p>
        <PasswordSettings key={`password:${user?.id}`} />
        <MFAManagement key={`mfa:${user?.id}`} />
        <BiometricSetup key={`biometric:${user?.id}`} />
        <LinkedAccounts key={`linked:${user?.id}`} />
      </main>
    </div>
  );
}
