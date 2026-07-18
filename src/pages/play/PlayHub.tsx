import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Compass, Key } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlayerPageHeader } from '@/components/layout/PlayerPageHeader';
import { JoinByInviteCodeDialog } from '@/components/round-robin/JoinByInviteCodeDialog';

const FindEvents = lazy(() => import('@/pages/player/FindEvents'));

const TabSkeleton = () => (
  <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto space-y-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-28 w-full rounded-xl" />
    ))}
  </div>
);

/**
 * PlayHub — player-side discovery surface.
 *
 * Phase 4 of the brand refresh slimmed this page to a single header
 * + embedded FindEvents feed. The RR overhaul Phase 4 adds:
 *   • A "Use a code" header action that opens JoinByInviteCodeDialog
 *   • Deep-link consumer for ?invite=XYZ-ABCD so a shared link can
 *     pre-fill the dialog and auto-preview the event
 *
 * The dialog handles its own auth bounce (user must be signed in to
 * call the join RPC), preview, capacity decision, and navigation.
 */
export default function PlayHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const inviteParam = searchParams.get('invite');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoPreview, setAutoPreview] = useState(false);
  // Snapshot the invite code before we strip it from the URL — otherwise
  // inviteParam is null on the next render and the dialog auto-preview never
  // fires with an empty initialCode.
  const [inviteCode, setInviteCode] = useState('');

  // Deep-link consumer — open the dialog automatically when the URL
  // carries ?invite=…. We strip the param from the URL after consumption
  // so a refresh doesn't re-trigger the dialog.
  useEffect(() => {
    if (inviteParam) {
      setInviteCode(inviteParam);
      setAutoPreview(true);
      setDialogOpen(true);
      // Clean the search param so the dialog is dismissible without
      // leaving a stale URL.
      const next = new URLSearchParams(searchParams);
      next.delete('invite');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  return (
    <div className="min-h-screen bg-background">
      <PlayerPageHeader
        icon={Compass}
        title="Find Play"
        subtitle="Round robins, open play, clinics, and other events near you."
        background="gradient"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAutoPreview(false);
              setDialogOpen(true);
            }}
            className="gap-1.5"
          >
            <Key className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Use a code</span>
            <span className="sm:hidden">Code</span>
          </Button>
        }
      />

      <Suspense fallback={<TabSkeleton />}>
        <FindEvents hideHeader />
      </Suspense>

      <JoinByInviteCodeDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setAutoPreview(false);
        }}
        initialCode={inviteCode}
        autoPreviewOnOpen={autoPreview}
      />
    </div>
  );
}
