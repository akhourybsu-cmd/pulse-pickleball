import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from "@/lib/logger";

interface BiometricLoginProps {
  email: string;
  onSuccess: () => void;
  onFallback: () => void;
}

interface CredentialInfo {
  credential_id: string;
  device_name: string;
}

export function BiometricLogin({ email, onSuccess, onFallback }: BiometricLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialInfo[]>([]);
  const { toast } = useToast();

  const logAnalytics = async (eventType: string, errorType?: string) => {
    try {
      const deviceInfo = {
        browser: navigator.userAgent,
        platform: navigator.platform,
      };
      
      await supabase.from('biometric_analytics').insert({
        event_type: eventType,
        error_type: errorType || null,
        device_info: deviceInfo,
      });
    } catch (err) {
      logger.error('Failed to log biometric analytics:', err);
    }
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    // Handle URL-safe base64
    const standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (standardBase64.length % 4)) % 4);
    const binaryString = atob(standardBase64 + padding);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Fetch credentials when email changes
  useEffect(() => {
    const fetchCredentials = async () => {
      if (!email || !email.includes('@')) {
        setCredentials([]);
        return;
      }

      setIsLoadingCredentials(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-biometric-credentials', {
          body: { email },
        });

        if (error) {
          logger.error('Error fetching credentials:', error);
          setCredentials([]);
          return;
        }

        if (data?.credentials) {
          setCredentials(data.credentials);
        } else {
          setCredentials([]);
        }
      } catch (err) {
        logger.error('Failed to fetch credentials:', err);
        setCredentials([]);
      } finally {
        setIsLoadingCredentials(false);
      }
    };

    fetchCredentials();
  }, [email]);

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await logAnalytics('login_attempt');

      if (credentials.length === 0) {
        throw new Error('No biometric credentials found for this account');
      }

      // Generate a random challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Build allowCredentials from fetched credentials
      const allowCredentials: PublicKeyCredentialDescriptor[] = credentials.map(cred => ({
        id: base64ToArrayBuffer(cred.credential_id),
        type: 'public-key',
        transports: ['internal', 'hybrid'] as AuthenticatorTransport[],
      }));

      // Request WebAuthn authentication with specific credentials
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
          allowCredentials,
        },
      }) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error('Authentication failed');
      }

      const response = assertion.response as AuthenticatorAssertionResponse;
      const credentialId = arrayBufferToBase64(assertion.rawId);
      const signature = arrayBufferToBase64(response.signature);
      const authenticatorData = arrayBufferToBase64(response.authenticatorData);
      const clientDataJSON = arrayBufferToBase64(response.clientDataJSON);

      // Verify with backend
      const { data, error: verifyError } = await supabase.functions.invoke('verify-biometric-auth', {
        body: {
          email,
          credentialId,
          signature,
          authenticatorData,
          clientDataJSON,
        },
      });

      if (verifyError) {
        throw verifyError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Use the tokens returned directly from the edge function
      if (data?.access_token && data?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) throw sessionError;

        await logAnalytics('login_success');

        toast({
          title: "Welcome back!",
          description: "Signed in with biometric authentication.",
        });

        onSuccess();
        return;
      }

      throw new Error('Failed to create session');

    } catch (error: any) {
      logger.error('Biometric login error:', error);

      let errorMessage = "Biometric authentication failed. Please try again or use your password.";
      let errorType = "verification_failed";

      if (error.name === 'NotAllowedError') {
        errorMessage = "Authentication was cancelled.";
        errorType = "user_cancelled";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Biometric authentication is not available on this device.";
        errorType = "no_hardware";
      } else if (error.name === 'InvalidStateError') {
        errorMessage = "No matching biometric credential found. Try using your password.";
        errorType = "no_credential";
      } else if (error.message?.includes('Too many attempts')) {
        errorMessage = "Too many attempts. Please wait 5 minutes or use your password.";
        errorType = "rate_limited";
      } else if (error.message?.includes('Network')) {
        errorMessage = "Connection error. Please check your internet and try again.";
        errorType = "network_error";
      } else if (error.message?.includes('No biometric credentials')) {
        errorMessage = "No biometric credentials found. Please use your password.";
        errorType = "no_credentials";
      }

      await logAnalytics('login_failed', errorType);

      setError(errorMessage);
      
      toast({
        title: "Authentication Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleBiometricLogin}
        disabled={isLoading || isLoadingCredentials || credentials.length === 0}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Authenticating...
          </>
        ) : isLoadingCredentials ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Fingerprint className="h-5 w-5 mr-2" />
            Sign in with Biometrics
          </>
        )}
      </Button>

      {credentials.length === 0 && !isLoadingCredentials && (
        <p className="text-xs text-center text-muted-foreground">
          No biometric credentials found for this email
        </p>
      )}

      <div className="text-center">
        <Button
          variant="link"
          onClick={onFallback}
          className="text-sm"
        >
          Use password instead
        </Button>
      </div>
    </div>
  );
}
