import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BiometricLoginProps {
  email: string;
  onSuccess: () => void;
  onFallback: () => void;
}

export function BiometricLogin({ email, onSuccess, onFallback }: BiometricLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate a random challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Request WebAuthn authentication
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
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

      if (data?.magicLink) {
        // Extract the tokens from the magic link
        const url = new URL(data.magicLink);
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;

          toast({
            title: "Welcome back!",
            description: "Signed in with biometric authentication.",
          });

          onSuccess();
          return;
        }
      }

      throw new Error('Failed to create session');

    } catch (error: any) {
      console.error('Biometric login error:', error);

      let errorMessage = "Biometric authentication failed. Please try again or use your password.";

      if (error.name === 'NotAllowedError') {
        errorMessage = "Authentication was cancelled.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Biometric authentication is not available on this device.";
      } else if (error.message?.includes('Too many attempts')) {
        errorMessage = "Too many attempts. Please wait 5 minutes or use your password.";
      } else if (error.message?.includes('Network')) {
        errorMessage = "Connection error. Please check your internet and try again.";
      }

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
        disabled={isLoading}
        className="w-full"
        size="lg"
      >
        <Fingerprint className="h-5 w-5 mr-2" />
        {isLoading ? 'Authenticating...' : 'Sign in with Biometrics'}
      </Button>

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
