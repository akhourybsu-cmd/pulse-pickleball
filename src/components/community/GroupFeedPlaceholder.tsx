import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface GroupFeedPlaceholderProps {
  className?: string;
}

function SkeletonPost({ opacity }: { opacity: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      className="p-4 rounded-xl bg-card border border-border/30 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <div className="flex gap-3">
        {/* Avatar skeleton */}
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        
        {/* Content skeleton */}
        <div className="flex-1 space-y-2.5">
          {/* Name and time */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          
          {/* Post content lines */}
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          
          {/* Reaction bar - grouped style */}
          <div className="flex items-center pt-1">
            <div className="flex items-center gap-1 bg-muted/40 rounded-full px-1.5 py-0.5">
              <Skeleton className="h-5 w-8 rounded-full" />
              <Skeleton className="h-5 w-8 rounded-full" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function GroupFeedPlaceholder({ className }: GroupFeedPlaceholderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Skeleton posts with decreasing opacity */}
      <SkeletonPost opacity={0.7} />
      <SkeletonPost opacity={0.45} />
      <SkeletonPost opacity={0.25} />
      
      {/* Helper text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-xs text-muted-foreground/60 py-3 flex items-center justify-center gap-1.5"
      >
        <span className="text-sm">⬇</span>
        Your post will appear here
      </motion.p>
    </div>
  );
}
