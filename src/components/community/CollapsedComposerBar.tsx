import { Camera, SquarePen } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CollapsedComposerBarProps {
  onExpand: () => void;
  onPhotoClick?: () => void;
  className?: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  contextName?: string;
  venueMode?: boolean;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CollapsedComposerBar({
  onExpand,
  onPhotoClick,
  className,
  avatarUrl,
  displayName,
  contextName,
  venueMode = false,
}: CollapsedComposerBarProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'border-t border-border/60 bg-background/[0.92] backdrop-blur-xl',
        'shadow-[0_-12px_32px_-24px_hsl(var(--foreground)/0.28)]',
        'pb-[env(safe-area-inset-bottom,0px)]',
        className
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-3 py-2.5 sm:px-4">
        <Avatar className="h-9 w-9 flex-shrink-0 ring-1 ring-border/60">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || 'You'} />}
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        {/* Tappable placeholder that opens drawer */}
        <button
          type="button"
          onClick={onExpand}
          className={cn(
            'flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3.5',
            'text-left text-sm text-muted-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]',
            'transition-colors duration-150 hover:border-primary/35 hover:text-foreground',
          )}
        >
          <SquarePen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            {venueMode && contextName ? `Share with ${contextName}…` : 'Share an update…'}
          </span>
        </button>

        {/* Quick action shortcuts */}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl border border-border/70 bg-card text-muted-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            if (onPhotoClick) {
              onPhotoClick();
            } else {
              onExpand();
            }
          }}
          aria-label="Post a photo"
        >
          <Camera className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </motion.div>
  );
}
