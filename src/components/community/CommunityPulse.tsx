import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CommunityPulseProps {
  activeTodayCount: number;
  sessionsThisWeek: number;
  onlineCount?: number;
  loading?: boolean;
  className?: string;
}

export function CommunityPulse({
  activeTodayCount,
  sessionsThisWeek,
  onlineCount = 0,
  loading = false,
  className,
}: CommunityPulseProps) {
  // Don't show if no activity data
  if (!loading && activeTodayCount === 0 && sessionsThisWeek === 0 && onlineCount === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className={cn('rounded-xl bg-muted/50 border border-border/30 p-3', className)}>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  const stats = [
    activeTodayCount > 0 && { value: activeTodayCount, label: 'active today' },
    onlineCount > 0 && { value: onlineCount, label: 'online' },
    sessionsThisWeek > 0 && { value: sessionsThisWeek, label: sessionsThisWeek === 1 ? 'session this week' : 'sessions this week' },
  ].filter(Boolean) as { value: number; label: string }[];

  if (stats.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70 bg-card p-3 shadow-[0_2px_10px_-6px_hsl(var(--foreground)/0.18)]',
        className
      )}
    >
      {/* Gold hairline — matches the community header band. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.7), transparent)' }}
      />
      {/* Header with pulsing dot */}
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Community Status
        </span>
      </div>
      
      {/* Divider */}
      <div className="mb-2 h-px bg-border/60" />
      
      {/* Stats row - wrap friendly */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        {stats.map((stat, index) => (
          <span key={stat.label} className="flex items-center gap-1.5 whitespace-nowrap">
            {index > 0 && <span className="text-border">•</span>}
            <span>
              <span className="font-semibold text-foreground">{stat.value}</span>
              {' '}{stat.label}
            </span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}
