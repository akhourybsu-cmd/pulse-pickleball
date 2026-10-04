import { useAuthState } from "@/hooks/useAuthState";
import { AccountPageHeader } from "@/components/profile/AccountPageHeader";
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
      <AccountPageHeader
        icon={ShieldCheck}
        title="Sign-in & security"
        subtitle="Manage your password and sign-in protection."
      />

      <main className="account-settings-content">
        <section aria-labelledby="account-protection-heading">
          <h2 id="account-protection-heading" className="account-section-label">
            Account protection
          </h2>
          <div className="space-y-3">
            <PasswordSettings key={`password:${user?.id}`} />
            <MFAManagement key={`mfa:${user?.id}`} />
          </div>
        </section>
        <section aria-labelledby="sign-in-methods-heading">
          <h2 id="sign-in-methods-heading" className="account-section-label">
            Ways to sign in
          </h2>
          <div className="space-y-3">
            <BiometricSetup key={`biometric:${user?.id}`} />
            <LinkedAccounts key={`linked:${user?.id}`} />
          </div>
        </section>
      </main>
    </div>
  );
}
