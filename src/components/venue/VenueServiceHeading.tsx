import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { VenueService } from '@/lib/venues/servicePresentation';

export function VenueServiceHeading({ service, icon: Icon, title, description, children }: {
  service: VenueService; icon: LucideIcon; title: string; description: string; children?: ReactNode;
}) {
  return <header data-venue-service={service} className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 sm:mb-5">
    <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
      <span className="venue-service-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><Icon aria-hidden className="h-5 w-5" /></span>
      <div className="min-w-0"><h2 className="font-sans text-lg font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-xl">{title}</h2><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p></div>
    </div>
    {children && <div className="flex max-w-full flex-wrap gap-2">{children}</div>}
  </header>;
}
