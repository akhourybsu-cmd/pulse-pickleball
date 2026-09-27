import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { stashPostAuthRedirect } from '@/lib/authRedirect';
import { communityAuthUrl } from '@/lib/communityAccess';

export function GuestAccountPrompt({ action = 'join in', name, returnTo }: { action?: string; name?: string; returnTo?: string }) {
  const location = useLocation();
  const target = returnTo || `${location.pathname}${location.search}${location.hash}`;
  return <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6" aria-label="Join PULSE">
    <h2 className="text-lg font-semibold">Make yourself at home{ name ? ` at ${name}` : '' }</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">You’re welcome to look around. Create a free PULSE account to {action}. We’ll bring you right back here when you’re ready.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button asChild className="min-h-11"><Link to={communityAuthUrl(target)} onClick={() => stashPostAuthRedirect(target)}>Create a free account</Link></Button>
      <Button asChild variant="outline" className="min-h-11"><Link to={communityAuthUrl(target, 'signin')} onClick={() => stashPostAuthRedirect(target)}>I already have an account</Link></Button>
    </div>
  </section>;
}
