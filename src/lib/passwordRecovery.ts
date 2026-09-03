import type { SupabaseClient } from "@supabase/supabase-js";

type RecoveryAuth = Pick<SupabaseClient["auth"], "initialize" | "setSession" | "getSession">;

const invalidLink = () => new Error("Please request a new password reset link.");
const authParameters = [
  "access_token", "refresh_token", "provider_token", "provider_refresh_token",
  "expires_in", "expires_at", "token_type", "type", "code", "state",
  "error", "error_code", "error_description",
];

/**
 * Admin-generated recovery links return implicit tokens even though OAuth uses
 * PKCE. Explicitly install that session before reading it; the SDK rejects an
 * implicit callback during PKCE initialization. Never fall back to a previous
 * account's session when the recovery callback itself failed.
 */
export async function preparePasswordRecovery(
  auth: RecoveryAuth,
  readUrl: () => string,
  replaceUrl: (path: string) => void,
) {
  const url = new URL(readUrl());
  const hash = new URLSearchParams(url.hash.slice(1));
  const get = (name: string) => hash.get(name) ?? url.searchParams.get(name);

  try {
    if (get("error") || get("error_code") || get("error_description")) {
      throw invalidLink();
    }

    const accessToken = get("access_token");
    const refreshToken = get("refresh_token");
    if (accessToken || refreshToken) {
      if (!accessToken || !refreshToken || get("type") !== "recovery") {
        throw invalidLink();
      }
      // setSession waits for SDK initialization and validates the returned
      // credentials with Auth; it does not trust a decoded JWT or URL claims.
      const { data, error } = await auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error || !data.session) throw invalidLink();
      return;
    }

    // Native PKCE recovery links are exchanged by SDK initialization. A code
    // still in the URL means it was not consumed (for example, another browser
    // without the verifier); do not accept an unrelated existing session.
    const { error: initializationError } = await auth.initialize();
    const remaining = new URL(readUrl());
    if (initializationError || (get("code") && (
      remaining.searchParams.has("code") ||
      new URLSearchParams(remaining.hash.slice(1)).has("code")
    ))) throw invalidLink();

    const { data, error } = await auth.getSession();
    if (error || !data.session) throw invalidLink();
  } finally {
    // Do not leave bearer credentials in the address bar/history, including
    // when verification fails. Preserve unrelated query parameters.
    const cleaned = new URL(readUrl());
    authParameters.forEach((name) => cleaned.searchParams.delete(name));
    replaceUrl(`${cleaned.pathname}${cleaned.search}`);
  }
}
