

# Biometric Authentication: Comprehensive Review & Fixes

## Executive Summary

After a thorough investigation of the biometric authentication system, I found **several critical issues** that prevent biometric login from working properly. The analytics data confirms this: there are 3 registered credentials and 14 analytics events, but **zero successful logins** (all `last_used_at` values are `null`).

---

## Current Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        BIOMETRIC AUTH FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ENROLLMENT (Works ✅)                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐             │
│  │ BiometricSetup│ → │ WebAuthn    │ → │ biometric_       │             │
│  │ (Profile page)│   │ .create()   │   │ credentials table│             │
│  └─────────────┘    └─────────────┘    └─────────────────┘             │
│                                                                         │
│  LOGIN (Broken ❌)                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐             │
│  │ BiometricLogin│ → │ WebAuthn    │ → │ Edge Function    │             │
│  │ (Auth page)  │   │ .get()      │   │ verify-biometric │             │
│  └─────────────┘    └─────────────┘    └─────────────────┘             │
│                           │                    │                        │
│                           │                    ▼                        │
│                           │            ┌──────────────┐                 │
│                           │            │ Magic Link   │ ← Wrong method! │
│                           │            │ (broken)     │                 │
│                           │            └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Issues Identified

### Issue 1: Critical - Magic Link Token Extraction Fails

**Location**: `BiometricLogin.tsx` (lines 96-119)

**Problem**: The code assumes `generateLink` returns tokens in the URL as query parameters:
```typescript
const url = new URL(data.magicLink);
const accessToken = url.searchParams.get('access_token');
const refreshToken = url.searchParams.get('refresh_token');
```

**Reality**: Supabase's `generateLink` returns a **hashed_token** in `properties.hashed_token`, NOT tokens in the URL. The URL contains a token hash that needs to be verified server-side using `verifyOtp`.

**Fix**: The edge function must call `verifyOtp` with the `hashed_token` to get the actual session tokens.

---

### Issue 2: Critical - Edge Function Uses Wrong Client for Credential Lookup

**Location**: `verify-biometric-auth/index.ts` (lines 46-49, 93-98)

**Problem**: The function creates an anon client to look up credentials:
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);
// Later uses this to query biometric_credentials
```

**Why it fails**: RLS policies on `biometric_credentials` require `auth.uid() = user_id`. Since the edge function uses the anon key with no authenticated user context, `auth.uid()` is null, so the query returns nothing.

**Fix**: Use the service role client for all database lookups in this edge function.

---

### Issue 3: Critical - WebAuthn allowCredentials Not Specified

**Location**: `BiometricLogin.tsx` (lines 57-65)

**Problem**: The current implementation doesn't specify `allowCredentials`:
```typescript
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge,
    rpId: window.location.hostname,
    userVerification: "required",
    timeout: 60000,
  },
}) as PublicKeyCredential | null;
```

**Why it's problematic**: Without `allowCredentials`, WebAuthn will try to find discoverable credentials (passkeys). The enrollment creates platform authenticators but may not create discoverable credentials. This can cause WebAuthn to fail to find the credential.

**Fix**: Fetch the user's credential IDs from the server and pass them in `allowCredentials` before calling `navigator.credentials.get()`.

---

### Issue 4: Edge Function Rate Limit Uses In-Memory Map

**Location**: `verify-biometric-auth/index.ts` (lines 17-37)

**Problem**: Rate limiting uses an in-memory `Map`:
```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
```

**Why it fails**: Edge functions are stateless. Each invocation may run in a different container, so the map resets on each cold start. This provides no actual rate limiting.

**Fix**: Use a database table or Redis for rate limiting state, or use Supabase's built-in rate limiting.

---

### Issue 5: Profile Lookup by Email Uses Anon Client

**Location**: `verify-biometric-auth/index.ts` (lines 70-83)

**Problem**: Looking up profile by email:
```typescript
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('id, email, biometric_enabled')
  .eq('email', email)
  .single();
```

**RLS Issue**: The profiles RLS policy for non-owner access is:
```sql
(auth.uid() IS NOT NULL) AND (auth.uid() <> id)
```

This requires an authenticated user. Using the anon key means `auth.uid()` is null, so this query will also fail.

---

### Issue 6: Email Check Leaks User Existence

**Location**: `Auth.tsx` (lines 212-236)

**Problem**: The `checkBiometricAvailability` function queries if a user has biometrics enabled:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('biometric_enabled')
  .eq('email', email)
  .maybeSingle();
```

**Security concern**: This allows unauthenticated users to determine if an email exists in the system by checking if they get biometric prompt vs. not.

---

## Recommended Fixes

### Fix 1: Update Edge Function to Use Service Role & verifyOtp

```typescript
// Use service role for ALL database operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Look up profile (using admin client)
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('id, email, biometric_enabled')
  .eq('email', email)
  .single();

// Look up credential (using admin client)
const { data: credential } = await supabaseAdmin
  .from('biometric_credentials')
  .select('*')
  .eq('user_id', profile.id)
  .eq('credential_id', credentialId)
  .single();

// Generate and verify the magic link to get actual session tokens
const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: profile.email,
});

// Use verifyOtp to get the actual session
const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'magiclink',
});

// Return the actual tokens
return new Response(
  JSON.stringify({ 
    success: true,
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token
  }),
  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

### Fix 2: Update BiometricLogin to Use Returned Tokens Directly

```typescript
// Instead of parsing magicLink URL
if (data?.access_token && data?.refresh_token) {
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  if (sessionError) throw sessionError;
  // Success!
}
```

### Fix 3: Add Credential Pre-fetch for allowCredentials

Create a new edge function or endpoint to fetch credential IDs for an email:

```typescript
// New edge function: get-biometric-credentials
// Returns credential IDs for a given email (no auth required, just IDs)

// Then in BiometricLogin:
const { data: credentialData } = await supabase.functions.invoke('get-biometric-credentials', {
  body: { email }
});

const assertion = await navigator.credentials.get({
  publicKey: {
    challenge,
    rpId: window.location.hostname,
    userVerification: "required",
    timeout: 60000,
    allowCredentials: credentialData.credentials.map(cred => ({
      id: base64ToArrayBuffer(cred.credential_id),
      type: 'public-key',
      transports: ['internal'],
    })),
  },
});
```

### Fix 4: Implement Proper Rate Limiting

Option A: Use database table
```sql
CREATE TABLE biometric_rate_limits (
  email TEXT PRIMARY KEY,
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ DEFAULT now()
);
```

Option B: Skip rate limiting in edge function and rely on Supabase's built-in protection.

---

## File Changes Summary

| File | Changes |
|------|---------|
| `supabase/functions/verify-biometric-auth/index.ts` | Complete rewrite: use service role, implement verifyOtp, return tokens directly |
| `src/components/auth/BiometricLogin.tsx` | Update to use tokens from response, add allowCredentials support |
| **NEW** `supabase/functions/get-biometric-credentials/index.ts` | New edge function to fetch credential IDs for email |
| `src/pages/Auth.tsx` | Update biometric availability check to use new endpoint |

---

## Testing Checklist

After implementation, test:

1. **Enrollment flow**: Enable biometrics on a new device
2. **Login flow**: Sign out, enter email, verify biometric prompt appears
3. **Credential matching**: Verify WebAuthn finds the correct credential
4. **Session creation**: Verify user is fully authenticated after biometric
5. **Fallback**: Verify "Use password instead" works
6. **Rate limiting**: Verify rate limits persist across function invocations
7. **Multi-device**: Test with credentials from different devices
8. **Error handling**: Test cancellation, timeout, and hardware failure scenarios

---

## Security Considerations

| Aspect | Current State | After Fix |
|--------|---------------|-----------|
| Token exchange | Broken (URL parsing) | Secure (server-side verifyOtp) |
| Rate limiting | None (in-memory) | Database-backed |
| Credential lookup | Fails (RLS blocks) | Works (service role) |
| User enumeration | Possible via biometric check | Minimize by caching check |
| Signature verification | Client-trusted | Should add server verification* |

*Note: Full server-side WebAuthn signature verification requires a WebAuthn library in Deno. The current implementation trusts the browser's WebAuthn API, which is acceptable for many use cases but not ideal for high-security applications.

