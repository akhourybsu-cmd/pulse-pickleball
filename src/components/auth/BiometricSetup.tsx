import { useAuthState } from '@/hooks/useAuthState';
import { withAuthDeadline } from '@/lib/authDeadline';
import { saveProfileChange } from '@/lib/saveProfileChange';
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Smartphone, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { logger } from "@/lib/logger";

interface BiometricCredential {
  id: string;
  credential_id: string;
  device_name: string;
  last_used_at: string | null;
  created_at: string;
}

export function BiometricSetup() {
  const { user } = useAuthState();
  const [loadError, setLoadError] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const lock = useRef(false);
  const [credentials, setCredentials] = useState<BiometricCredential[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkBiometricSupport();
    void loadCredentials();
  }, []);

  const checkBiometricSupport = () => {
    const supported = window.PublicKeyCredential !== undefined &&
                     navigator.credentials !== undefined;
    setIsSupported(supported);
  };

  const loadCredentials = async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const [devices, settings] = await Promise.all([
        withAuthDeadline(signal => supabase
          .from('biometric_credentials').select('id, credential_id, device_name, last_used_at, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false }).abortSignal(signal)),
        withAuthDeadline(signal => supabase.from('profiles').select('biometric_enabled')
          .eq('id', user.id).abortSignal(signal).single()),
      ]);
      const { data, error } = devices;
      if (error) throw error;
      if (settings.error) throw settings.error;
      if (!settings.data) throw new Error('Device sign-in settings could not be confirmed.');
      setCredentials(data ?? []);
      setBiometricEnabled(settings.data.biometric_enabled === true && !!data?.length);
      return data ?? [];
    } catch { setLoadError(true); return null; }
    finally { setLoadingDevices(false); }
  };

  const getBrowserName = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Edg/')) return 'Edge';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Browser';
  };

  const getDeviceName = () => {
    const platform = navigator.platform;
    const browser = getBrowserName();
    return `${browser} on ${platform}`;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const logAnalytics = async (eventType: string, errorType?: string) => {
    try {
      const deviceInfo = {
        browser: navigator.userAgent,
        platform: navigator.platform,
        device_name: getDeviceName(),
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

  const handleEnroll = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support biometric authentication. Please use Chrome, Safari, or Edge.",
        variant: "destructive",
      });
      return;
    }

    if (lock.current || !user || loadingDevices || loadError) return;
    lock.current = true;
    setIsLoading(true);

    try {
      void logAnalytics('enrollment_started');

      if (!user) throw new Error('Not authenticated');

      // Generate a random challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      // Create WebAuthn credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "PULSE Pickleball",
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: user.email || 'user',
            displayName: user.email || 'user',
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      const credentialId = arrayBufferToBase64(credential.rawId);
      const publicKey = arrayBufferToBase64(response.getPublicKey()!);

      // Store credential in database
      const { error } = await withAuthDeadline(signal => supabase
        .from('biometric_credentials')
        .insert({
          user_id: user.id,
          credential_id: credentialId,
          public_key: publicKey,
          device_name: getDeviceName(),
        }).abortSignal(signal));

      if (error) throw error;

      await saveProfileChange(user.id, { biometric_enabled: true });

      void logAnalytics('enrollment_success');

      setBiometricEnabled(true);
      await loadCredentials();

      toast({
        title: "Biometric Enabled",
        description: "You can now sign in with your fingerprint or Face ID on this device.",
      });
    } catch (error: any) {
      logger.error('Enrollment error:', error);
      
      let errorMessage = "Failed to enable biometric login.";
      let errorType = "verification_failed";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Biometric authentication was cancelled. Please try again when ready.";
        errorType = "user_cancelled";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "No biometric hardware detected on this device.";
        errorType = "no_hardware";
      } else if (error.name === 'SecurityError') {
        errorMessage = "Security error. Make sure you're on a secure connection (HTTPS).";
        errorType = "network_error";
      }

      void logAnalytics('enrollment_failed', errorType);

      toast({
        title: "Enrollment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      lock.current = false;
      setIsLoading(false);
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    if (!user || lock.current) return;
    lock.current = true;
    setIsLoading(true);
    try {
      const { error } = await withAuthDeadline(signal => supabase.from('biometric_credentials')
        .delete().eq('id', credentialId).eq('user_id', user.id).abortSignal(signal));
      if (error) throw error;
      const remaining = await loadCredentials();
      if (!remaining) throw new Error('Could not confirm the remaining devices.');
      if (!remaining.length) await saveProfileChange(user.id, { biometric_enabled: false });
      setCredentialToDelete(null);
      toast({ title: 'Device removed', description: 'This device can no longer be used for biometric login.' });
    } catch { toast({ title: 'Could not remove device', description: 'Check your connection and try again.', variant: 'destructive' }); }
    finally { lock.current = false; setIsLoading(false); }
  };

  if (loadingDevices || loadError) return <Card><CardHeader><CardTitle>Biometric authentication</CardTitle></CardHeader><CardContent>{loadError ? <div role="alert"><p>Couldn’t load your registered devices.</p><Button variant="outline" onClick={() => void loadCredentials()}>Try again</Button></div> : <p>Loading registered devices…</p>}</CardContent></Card>;
  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Biometric Authentication
          </CardTitle>
          <CardDescription>
            Sign in faster with fingerprint or Face ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your browser doesn't support biometric authentication. Please use Chrome, Safari, or Edge to enable this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Biometric Authentication (Optional)
          </CardTitle>
          <CardDescription>
            Sign in faster with fingerprint or Face ID on this device. Your password will always work as a backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {biometricEnabled && credentials.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Biometric login enabled</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Registered Devices</h4>
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{cred.device_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cred.last_used_at
                            ? `Last used ${formatDistanceToNow(new Date(cred.last_used_at))} ago`
                            : 'Never used'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isLoading}
                      aria-label={`Remove ${cred.device_name}`}
                      onClick={() => setCredentialToDelete(cred.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleEnroll}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                <Fingerprint className="h-4 w-4 mr-2" />
                Add Another Device
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Biometric authentication is optional. You can always sign in with your password.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleEnroll}
                disabled={isLoading}
                className="w-full"
              >
                <Fingerprint className="h-4 w-4 mr-2" />
                {isLoading ? 'Setting up...' : 'Enable on This Device'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!credentialToDelete} onOpenChange={() => setCredentialToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Device?</AlertDialogTitle>
            <AlertDialogDescription>
              This device will no longer be able to use biometric login. You can always add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLoading}
              onClick={event => { event.preventDefault(); if (credentialToDelete) void handleDeleteCredential(credentialToDelete); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
