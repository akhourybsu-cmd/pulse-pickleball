import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, Users, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGroups } from '@/hooks/useGroups';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { stashPostAuthRedirect } from '@/lib/authRedirect';

interface GroupPreview {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  member_count: number | null;
  icon_url: string | null;
}

type Phase = 'loading' | 'preview' | 'need_auth' | 'joining' | 'success' | 'error';

/**
 * Handles invite links of the form /player/community/join/:code.
 *
 * Flow:
 *   1. Look up the group by code (works for logged-out users too — RPC is
 *      SECURITY DEFINER with EXECUTE granted to anon).
 *   2. If logged out, show "You're invited to {name}" + Sign in / Sign up.
 *   3. If logged in, call join_group_by_code, then show an explicit success
 *      state ("You joined {name}") with an Open community button.
 */
export default function JoinGroupByCode() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { joinGroupByCode, currentUserId } = useGroups();

  const [phase, setPhase] = useState<Phase>('loading');
  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [resultStatus, setResultStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const joinAttempted = useRef(false);

  // Step 1 — preview the group from the code
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setPhase('error');
        setErrorMsg('Missing invite code.');
        return;
      }
      const { data, error } = await supabase.rpc(
        'find_group_by_invite_code' as any,
        { p_code: code }
      );
      if (cancelled) return;
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setPhase('error');
        setErrorMsg('This invite code is invalid or has been revoked.');
        return;
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      setGroup({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        visibility: row.visibility,
        member_count: row.member_count ?? null,
        icon_url: row.icon_url ?? null,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setPhase(user ? 'preview' : 'need_auth');
    })();
    return () => { cancelled = true; };
  }, [code]);

  // Step 2 — auto-join once we know who the user is and have a preview
  useEffect(() => {
    if (phase !== 'preview' || !code || !currentUserId || joinAttempted.current) return;
    joinAttempted.current = true;
    (async () => {
      setPhase('joining');
      const result = await joinGroupByCode(code);
      if (!result?.id) {
        setPhase('error');
        setErrorMsg('We couldn\'t add you to this group. The code may have been revoked.');
        return;
      }
      setResultStatus((result as any).status ?? 'joined');
      setPhase('success');
    })();
  }, [phase, code, currentUserId, joinGroupByCode]);

  const goToAuth = (mode: 'signin' | 'signup') => {
    stashPostAuthRedirect(`/player/community/join/${code}`);
    navigate(`/auth${mode === 'signup' ? '?tab=signup' : ''}`, { replace: false });
  };

  // ---------- Render ----------
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-5">
          {phase === 'loading' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Looking up invite…</p>
            </>
          )}

          {phase === 'error' && (
            <>
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <div>
                <p className="text-lg font-semibold">Invite not available</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              </div>
              <Button onClick={() => navigate('/player/community')} className="w-full">
                Back to Community
              </Button>
            </>
          )}

          {(phase === 'need_auth' || phase === 'preview' || phase === 'joining') && group && (
            <>
              {group.icon_url ? (
                <img
                  src={group.icon_url}
                  alt=""
                  className="w-16 h-16 rounded-xl mx-auto object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-primary/10 mx-auto flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                  {group.visibility === 'private' && <Lock className="h-3 w-3" />}
                  You're invited to
                </p>
                <p className="text-2xl font-bold mt-1">{group.name}</p>
                {group.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{group.description}</p>
                )}
                {typeof group.member_count === 'number' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                  </p>
                )}
              </div>

              {phase === 'joining' && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Joining…</span>
                </div>
              )}

              {phase === 'need_auth' && (
                <div className="space-y-2">
                  <Button onClick={() => goToAuth('signin')} className="w-full">
                    Sign in to join
                  </Button>
                  <Button variant="outline" onClick={() => goToAuth('signup')} className="w-full">
                    Create an account
                  </Button>
                </div>
              )}
            </>
          )}

          {phase === 'success' && group && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="text-2xl font-bold">
                  {resultStatus === 'already_member'
                    ? `Welcome back to ${group.name}`
                    : `You joined ${group.name}`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {resultStatus === 'already_member'
                    ? 'You\'re already a member of this crew.'
                    : 'You\'re in. Say hi in the feed!'}
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => navigate(`/player/community/group/${group.id}`)}
                  className="w-full"
                >
                  Open {group.name}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/player/community')}
                  className="w-full"
                >
                  Back to Community
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
