import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";

/**
 * Public, logged-out-accessible Privacy Policy at a clean /privacy URL — the
 * link you give Google Play / the App Store. Reuses the existing PrivacyPolicy
 * content component (which carries its own heading + last-updated date).
 */
export default function Privacy() {
  return (
    <LegalPageLayout>
      <PrivacyPolicy />
    </LegalPageLayout>
  );
}
