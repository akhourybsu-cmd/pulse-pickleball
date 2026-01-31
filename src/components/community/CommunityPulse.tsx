import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CommunityPulseProps {
  activeTodayCount: number;
  sessionsThisWeek: number;
  loading?: boolean;
  className?: string;
}

export function CommunityPulse({
  activeTodayCount,
  sessionsThisWeek,
  loading = false,
  className,
}: CommunityPulseProps) {
  // Don't show if no activity data
  if (!loading && activeTodayCount === 0 && sessionsThisWeek === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-3 px-1 py-2', className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-36" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-4 text-xs text-muted-foreground px-1 py-2',
        className
      )}
    >
      {activeTodayCount > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span>
            <span className="font-medium text-foreground">{activeTodayCount}</span>
            {' '}active today
          </span>
        </div>
      )}
      
      {sessionsThisWeek > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">⚡</span>
          <span>
            <span className="font-medium text-foreground">{sessionsThisWeek}</span>
            {' '}{sessionsThisWeek === 1 ? 'session' : 'sessions'} this week
          </span>
        </div>
      )}
    </motion.div>
  );
}
