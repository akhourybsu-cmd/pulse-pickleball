import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { TermsOfService } from "@/components/legal/TermsOfService";

/**
 * Public Terms of Service at a clean /terms URL (referenced from Auth + the
 * app-store listing). Reuses the existing TermsOfService content component.
 */
export default function Terms() {
  return (
    <LegalPageLayout>
      <TermsOfService />
    </LegalPageLayout>
  );
}
