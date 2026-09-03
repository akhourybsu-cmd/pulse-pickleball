// Gateway JWT validation alone does not authorize privileged work: the public
// anon key is also a valid JWT. Match the configured server credential itself,
// never an unverified role claim. No credentials are logged or returned.
export async function isServiceRoleRequest(
  request: Request,
  serviceRoleKey: string | undefined,
  secretKeysJson?: string,
): Promise<boolean> {
  const token = request.headers.get("Authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (serviceRoleKey && token && await equalCredential(token, serviceRoleKey)) return true;

  // Hosted Supabase may supply an internal legacy service token that differs
  // from dashboard keys. New server callers authenticate with a secret API key
  // on apikey, validated against the platform's managed secret-key dictionary.
  const apiKey = request.headers.get("apikey");
  if (!apiKey?.startsWith("sb_secret_") || !secretKeysJson) return false;
  try {
    const keys: unknown = JSON.parse(secretKeysJson);
    if (!keys || typeof keys !== "object" || Array.isArray(keys)) return false;
    for (const key of Object.values(keys)) {
      if (typeof key === "string" && key.startsWith("sb_secret_") && await equalCredential(apiKey, key)) return true;
    }
  } catch { /* Missing/malformed configuration must fail closed. */ }
  return false;
}

async function equalCredential(token: string, expectedKey: string): Promise<boolean> {
  if (token.length !== expectedKey.length) return false;

  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedKey)),
  ]);
  const received = new Uint8Array(receivedHash);
  const expected = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= received[index] ^ expected[index];
  }
  return difference === 0;
}
