import { Image, Calendar, BarChart3, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface ComposerQuickActionsProps {
  onPhotoClick: () => void;
  onEventClick: () => void;
  onPollClick: () => void;
  onQuestionClick: () => void;
  className?: string;
}

export function ComposerQuickActions({
  onPhotoClick,
  onEventClick,
  onPollClick,
  onQuestionClick,
  className,
}: ComposerQuickActionsProps) {
  const actions: QuickAction[] = [
    { icon: <span className="text-sm">📸</span>, label: 'Photo', onClick: onPhotoClick },
    { icon: <span className="text-sm">📅</span>, label: 'Event', onClick: onEventClick },
    { icon: <span className="text-sm">📊</span>, label: 'Poll', onClick: onPollClick },
    { icon: <span className="text-sm">❓</span>, label: 'Ask', onClick: onQuestionClick },
  ];

  return (
    <div className={cn('flex items-center gap-1.5 overflow-x-auto no-scrollbar', className)}>
      {actions.map((action) => (
        <motion.div key={action.label} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className={cn(
              'h-7 px-2.5 gap-1.5 text-xs',
              'bg-muted/30 hover:bg-muted/50',
              'text-muted-foreground hover:text-foreground',
              'rounded-full shrink-0'
            )}
          >
            {action.icon}
            <span>{action.label}</span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}
