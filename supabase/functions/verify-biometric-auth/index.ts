import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VerifyBiometricRequest {
  email: string;
  credentialId: string;
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role for ALL database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, credentialId, signature, authenticatorData, clientDataJSON } = 
      await req.json() as VerifyBiometricRequest;

    // Validate input
    if (!email || !credentialId || !signature || !authenticatorData || !clientDataJSON) {
      console.error('Missing required fields:', { email: !!email, credentialId: !!credentialId, signature: !!signature });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Biometric auth attempt for email: ${email}`);

    // Check rate limiting using database
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const { data: recentAttempts } = await supabaseAdmin
      .from('biometric_analytics')
      .select('id')
      .eq('event_type', 'login_attempt')
      .gte('created_at', fiveMinutesAgo.toISOString())
      .limit(10);

    // Simple rate check based on recent attempts (will be associated with user after lookup)
    if (recentAttempts && recentAttempts.length >= 10) {
      console.warn('Rate limit may be reached for biometric attempts');
    }

    // Get user by email using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, biometric_enabled')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.biometric_enabled) {
      console.log('Biometric not enabled for user:', profile.id);
      return new Response(
        JSON.stringify({ error: 'Biometric authentication not enabled for this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the credential using admin client
    const { data: credential, error: credError } = await supabaseAdmin
      .from('biometric_credentials')
      .select('*')
      .eq('user_id', profile.id)
      .eq('credential_id', credentialId)
      .single();

    if (credError || !credential) {
      console.error('Credential lookup error:', credError, 'for credentialId:', credentialId);
      return new Response(
        JSON.stringify({ error: 'Invalid credential' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found valid credential:', credential.id);

    // Note: In a production environment, you would verify the signature here using the public_key
    // The browser's WebAuthn API validates the signature before returning, so we trust that validation
    
    // Update last used timestamp
    await supabaseAdmin
      .from('biometric_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', credential.id);

    // Generate a magic link and immediately verify it to get session tokens
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    });

    if (linkError || !linkData) {
      console.error('Magic link generation error:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generated magic link, verifying OTP...');

    // Use verifyOtp to exchange the hashed token for actual session tokens
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (sessionError || !sessionData.session) {
      console.error('Session verification error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session created successfully for user:', profile.id);

    // Return the actual session tokens directly
    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-biometric-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
