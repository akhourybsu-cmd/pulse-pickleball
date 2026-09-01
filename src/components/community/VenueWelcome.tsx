import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A venue's welcome note at the top of its community feed.
 *
 * Deliberately quiet and collapsible: this is the one piece of copy a venue
 * writes once and every member then sees on every visit, so an always-expanded
 * block would push the actual feed below the fold forever. It collapses to a
 * single line after the first paragraph's worth of text.
 */

interface VenueWelcomeProps {
  headline: string | null;
  message: string | null;
  /** `#rrggbb` only — alpha is composited onto it. See VenueChrome.accentHex. */
  accent?: string | null;
}

const COLLAPSE_OVER = 180;

export function VenueWelcome({ headline, message, accent }: VenueWelcomeProps) {
  const [expanded, setExpanded] = useState(false);

  if (!headline && !message) return null;

  const long = (message?.length ?? 0) > COLLAPSE_OVER;
  const shown = long && !expanded ? `${message!.slice(0, COLLAPSE_OVER).trimEnd()}…` : message;

  return (
    <section
      className="rounded-xl border bg-card/60 p-4"
      style={accent ? { borderColor: `${accent}40` } : undefined}
      aria-label="Welcome from the venue"
    >
      {headline && (
        <h2 className="text-sm font-semibold leading-snug text-foreground">{headline}</h2>
      )}
      {shown && (
        <p
          className={cn(
            'whitespace-pre-line text-sm text-muted-foreground',
            headline && 'mt-1',
          )}
        >
          {shown}
        </p>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {expanded ? 'Show less' : 'Read more'}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      )}
    </section>
  );
}
