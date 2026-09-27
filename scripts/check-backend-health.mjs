import { loadEnv } from "vite";
import { validateBackend } from "../src/lib/backendPolicy.mjs";

// Read-only: verifies that even an opaque publishable key belongs to the pinned
// project. Do not create users or print keys/response bodies in release logs.
try {
  const config = validateBackend(
    loadEnv("production", process.cwd(), "VITE_SUPABASE_")
  );
  const response = await fetch(`${config.url}/auth/v1/settings`, {
    headers: { apikey: config.publishableKey },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(`Production auth preflight failed (${response.status}).`);
  const settings = await response.json();
  if (
    typeof settings.disable_signup !== "boolean" ||
    typeof settings.external !== "object"
  )
    throw new Error("Unexpected production auth settings response.");
  console.log(
    `Production public key and auth endpoint verified: ${config.projectId}.`
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
