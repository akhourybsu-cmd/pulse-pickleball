import { useNavigate } from 'react-router-dom';
import { Calendar, Users, ChevronRight, CalendarClock } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpcomingPlay } from '@/hooks/useUpcomingPlay';

function whenLabel(d: Date): string {
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow · ${format(d, 'h:mm a')}`;
  return format(d, 'EEE, MMM d · h:mm a');
}

/**
 * "Your upcoming play" — the player's registered events + active round robins,
 * shown at the top of the Play hub. Renders nothing when there's nothing coming
 * up, so it never clutters the discovery feed for new users.
 */
export function UpcomingPlaySection() {
  const navigate = useNavigate();
  const { items, loading } = useUpcomingPlay();

  if (loading) {
    return (
      <div className="px-4 sm:px-6 pt-4 max-w-3xl mx-auto space-y-2">
        <Skeleton className="h-5 w-44 rounded" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  const shown = items.slice(0, 5);
  const more = items.length - shown.length;

  return (
    <section className="px-4 sm:px-6 pt-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight font-display">Your upcoming play</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>

      <div className="space-y-2">
        {shown.map((it) => {
          const Icon = it.kind === 'round_robin' ? Users : Calendar;
          return (
            <button
              key={it.key}
              onClick={() => navigate(it.href)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99] text-left"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  <span className="capitalize">{whenLabel(it.date)}</span> · {it.subtitle}
                  {it.role === 'host' ? ' · Hosting' : ''}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>

      {more > 0 && (
        <p className="text-xs text-muted-foreground mt-2 pl-1">+{more} more upcoming</p>
      )}
    </section>
  );
}
