import { Camera } from 'lucide-react';
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
}: CollapsedComposerBarProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'border-t border-border/30 bg-background/95 backdrop-blur-sm',
        'shadow-[0_-2px_10px_rgba(0,0,0,0.05)]',
        'pb-[env(safe-area-inset-bottom,0px)]',
        className
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
        <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-background">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || 'You'} />}
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        {/* Tappable placeholder that opens drawer */}
        <button
          onClick={onExpand}
          className={cn(
            'flex-1 h-10 px-4 rounded-full',
            'bg-muted/50 hover:bg-muted/70',
            'text-muted-foreground text-left text-sm',
            'transition-colors duration-150',
            'flex items-center gap-2'
          )}
        >
          <span>Share an update...</span>
        </button>

        {/* Quick action shortcuts */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            if (onPhotoClick) {
              onPhotoClick();
            } else {
              onExpand();
            }
          }}
        >
          <Camera className="h-5 w-5" />
        </Button>
      </div>
    </motion.div>
  );
}
