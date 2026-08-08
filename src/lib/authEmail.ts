import { supabase } from "@/integrations/supabase/client";

export type AuthEmailType =
  | "recovery"
  | "signup"
  | "magiclink"
  | "email_change"
  | "invite";

/**
 * Sends a branded PULSE auth email through our own pipeline (Resend on the
 * verified pulsepb.com domain) instead of the default Supabase sender.
 */
export async function sendAuthEmail(params: {
  type: AuthEmailType;
  email: string;
  newEmail?: string;
  redirectTo?: string;
}) {
  const { error } = await supabase.functions.invoke("auth-email", {
    body: {
      type: params.type,
      email: params.email,
      newEmail: params.newEmail,
      redirectTo: params.redirectTo ?? `${window.location.origin}/`,
    },
  });
  if (error) throw error;
}
