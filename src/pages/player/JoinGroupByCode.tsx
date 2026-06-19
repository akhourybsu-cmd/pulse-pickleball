import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGroups } from '@/hooks/useGroups';
import { Button } from '@/components/ui/button';
import { stashPostAuthRedirect } from '@/lib/authRedirect';

/**
 * Handles invite links of the form /player/community/join/:code.
 * Calls the join_group_by_code RPC and routes the user accordingly.
 */
export default function JoinGroupByCode() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { joinGroupByCode, currentUserId } = useGroups();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState<string>('Joining group…');
  const attempted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setStatus('error');
        setMessage('Missing invite code.');
        return;
      }

      // If not signed in yet, bounce to auth and come back here.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        storePostAuthRedirect(`/player/community/join/${code}`);
        navigate('/auth', { replace: true });
        return;
      }

      // Wait for useGroups to know who we are, then attempt once.
      if (!currentUserId || attempted.current) return;
      attempted.current = true;

      const result = await joinGroupByCode(code);
      if (cancelled) return;

      if (result?.id) {
        navigate(`/player/community/group/${result.id}`, { replace: true });
      } else {
        setStatus('error');
        setMessage('That invite code is not valid or no longer available.');
      }
    })();
    return () => { cancelled = true; };
  }, [code, currentUserId, joinGroupByCode, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      {status === 'working' ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{message}</p>
        </>
      ) : (
        <>
          <p className="text-lg font-medium">{message}</p>
          <Button onClick={() => navigate('/player/community')}>Back to Community</Button>
        </>
      )}
    </div>
  );
}
