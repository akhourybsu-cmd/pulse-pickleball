import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { confirmMfaSession } from '@/lib/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmailMFAChallengeProps {
  open: boolean;
  email: string;
  purpose?: 'sign_in' | 'enroll';
  onSuccess: () => void;
  onCancel: () => void;
}

export const EmailMFAChallenge = ({ open, email, purpose = 'sign_in', onSuccess, onCancel }: EmailMFAChallengeProps) => {
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const sending = useRef(false);

  const sendCode = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    const attempt = generation.current;
    setBusy(true); setError(null); setCode(''); setChallengeId(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('Sign in again before requesting a code.');
      const { data, error: sendError } = await supabase.functions.invoke('send-mfa-code', {
        body: { purpose }, headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(15_000),
      });
      if (sendError || !data?.success || !data.challengeId) throw new Error('Could not send a code. Wait a moment and retry. Too many attempts require a 10-minute pause.');
      if (attempt !== generation.current) return;
      setOwnerId(session.user.id); setChallengeId(data.challengeId);
    } catch (failure) {
      if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Could not send a code.');
    } finally { sending.current = false; if (attempt === generation.current) setBusy(false); }
  }, [purpose]);

  useEffect(() => {
    const nextGeneration = ++generation.current;
    setCode(''); setChallengeId(null); setError(null); setBusy(false);
    return () => { generation.current = nextGeneration + 1; };
  }, [open, purpose]);

  const verify = async () => {
    if (busy || !challengeId || !/^\d{6}$/.test(code)) return;
    const attempt = generation.current;
    setBusy(true); setError(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || session.user.id !== ownerId) throw new Error('Your account changed. Cancel and request a code for the current account.');
      const { data, error: verifyError } = await supabase.functions.invoke('verify-mfa-code', {
        body: { challengeId, code }, headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(15_000),
      });
      if (verifyError || !data?.success) throw new Error('The code could not be verified. Check the latest code, or request a new one after waiting.');
      const security = await confirmMfaSession();
      if (attempt !== generation.current) return;
      if (security.userId !== ownerId) throw new Error('Your account changed during verification.');
      setCode(''); onSuccess();
    } catch (failure) {
      if (attempt === generation.current) { setCode(''); setError(failure instanceof Error ? failure.message : 'Could not verify the code.'); }
    } finally { if (attempt === generation.current) setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={next => { if (!next && !busy) onCancel(); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{purpose === 'enroll' ? 'Verify email protection' : 'Email verification'}</DialogTitle><DialogDescription>Request a code at your verified account email{email ? ` (${email})` : ''}, then enter it below. It works only for this sign-in session.</DialogDescription></DialogHeader><div className="space-y-4">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p role="status" className="text-sm text-muted-foreground">{busy ? 'Checking…' : challengeId ? 'Code sent. Use the latest code within 10 minutes.' : 'Request a code to continue.'}</p>
    <Label htmlFor="email-code">Verification code</Label><Input id="email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy || !challengeId} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => { if (e.key === 'Enter') void verify(); }} />
    <Button variant="outline" onClick={() => void sendCode()} disabled={busy}>{challengeId ? 'Resend code' : 'Send code'}</Button>
    <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>Cancel</Button><Button className="flex-1" onClick={() => void verify()} disabled={busy || !challengeId || code.length !== 6}>Verify</Button></div>
  </div></DialogContent></Dialog>;
};
