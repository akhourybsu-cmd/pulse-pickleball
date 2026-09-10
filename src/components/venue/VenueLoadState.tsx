import { AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function VenueLoadState({ title = 'We couldn’t load this venue', description = 'The connection may have dropped, or this space may not be available to your account.', onRetry, fullPage = false }: {
  title?: string; description?: string; onRetry: () => void; fullPage?: boolean;
}) {
  return <div className={fullPage ? 'mx-auto max-w-xl px-4 py-12' : ''}>
    <section role="alert" className="rounded-2xl border border-border/80 bg-card p-5 font-sans sm:p-6">
      <AlertCircle className="mb-3 h-5 w-5 text-muted-foreground" />
      <h2 className="font-sans text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onRetry} variant="outline" className="min-h-11 rounded-xl"><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
        {fullPage && <Button asChild variant="ghost" className="min-h-11 rounded-xl"><Link to="/player/community">Back to Community</Link></Button>}
      </div>
    </section>
  </div>;
}
