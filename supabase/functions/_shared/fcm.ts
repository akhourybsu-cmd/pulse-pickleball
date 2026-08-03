// Native push via FCM HTTP v1. Gated on the FCM_SERVICE_ACCOUNT_JSON secret:
// if it's absent or unparseable, every call here is a no-op, so the rest of the
// notification pipeline keeps working (web push only) until Firebase is set up.
//
// FCM v1 auth is OAuth2: we sign a short-lived JWT with the service account's
// private key and exchange it for an access token (cached per invocation).
import { createClient } from "npm:@supabase/supabase-js@2";

type Admin = ReturnType<typeof createClient>;

export interface FcmPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  priority?: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cachedToken: { token: string; exp: number } | null = null;

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

function getServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (sa?.client_email && sa?.private_key && sa?.project_id) return sa as ServiceAccount;
  } catch {
    console.error("FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  return null;
}

async function mintAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${header}.${claim}`;

  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToPkcs8(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
    const jwt = `${signingInput}.${b64url(new Uint8Array(sig))}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    if (!res.ok) {
      console.error("FCM token mint failed", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
    return cachedToken.token;
  } catch (e) {
    console.error("FCM token mint error", e);
    return null;
  }
}

/**
 * Fan a notification out to all of a user's native device tokens. Returns the
 * number delivered (0 if Firebase isn't configured or the user has no native
 * devices). Prunes tokens the OS reports as unregistered.
 */
export async function sendFcmToUser(admin: Admin, userId: string, payload: FcmPayload): Promise<number> {
  const sa = getServiceAccount();
  if (!sa) return 0; // Firebase not configured — no-op

  const { data: tokens } = await admin
    .from("device_tokens")
    .select("id, token")
    .eq("user_id", userId);
  if (!tokens || tokens.length === 0) return 0;

  const accessToken = await mintAccessToken(sa);
  if (!accessToken) return 0;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(tokens.map(async (t: { id: string; token: string }) => {
    const message = {
      message: {
        token: t.token,
        notification: { title: payload.title, body: payload.body ?? "" },
        // FCM data values must be strings; the client reads `link` on tap.
        data: { link: payload.url ?? "/", tag: payload.tag ?? "pulse" },
        android: { priority: payload.priority === "high" ? "high" : "normal" },
      },
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (res.ok) {
        sent++;
      } else if (res.status === 404) {
        // UNREGISTERED — token no longer valid, drop it.
        dead.push(t.id);
      } else {
        console.error("FCM send failed", res.status, await res.text());
      }
    } catch (e) {
      console.error("FCM send error", e);
    }
  }));

  if (dead.length > 0) await admin.from("device_tokens").delete().in("id", dead);
  return sent;
}
