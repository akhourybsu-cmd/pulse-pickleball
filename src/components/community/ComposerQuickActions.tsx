import { memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  colorClass: string;
}

interface ComposerQuickActionsProps {
  onPhotoClick: () => void;
  onEventClick: () => void;
  onPollClick: () => void;
  onQuestionClick: () => void;
  className?: string;
}

export const ComposerQuickActions = memo(function ComposerQuickActions({
  onPhotoClick,
  onEventClick,
  onPollClick,
  onQuestionClick,
  className,
}: ComposerQuickActionsProps) {
  const actions: QuickAction[] = [
    { 
      icon: <span className="text-sm">📸</span>, 
      label: 'Photo', 
      onClick: onPhotoClick,
      colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 border-teal-500/20',
    },
    { 
      icon: <span className="text-sm">📅</span>, 
      label: 'Event', 
      onClick: onEventClick,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20',
    },
    { 
      icon: <span className="text-sm">📊</span>, 
      label: 'Poll', 
      onClick: onPollClick,
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20',
    },
    { 
      icon: <span className="text-sm">❓</span>, 
      label: 'Ask', 
      onClick: onQuestionClick,
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20',
    },
  ];

  return (
    <div className={cn('flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5', className)}>
      {actions.map((action) => (
        <motion.div key={action.label} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className={cn(
              'h-6 sm:h-7 px-2 sm:px-3 gap-1 sm:gap-1.5 text-xs font-medium',
              'rounded-full shrink-0 border',
              'transition-all duration-200',
              action.colorClass
            )}
          >
            {action.icon}
            <span>{action.label}</span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
});
