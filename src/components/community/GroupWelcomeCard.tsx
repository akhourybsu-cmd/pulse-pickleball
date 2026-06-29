import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ActionCard {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  colorClass: string;
}

interface GroupWelcomeCardProps {
  groupName: string;
  onPostUpdate: () => void;
  onScheduleSession: () => void;
  onAskQuestion: () => void;
  className?: string;
}

export function GroupWelcomeCard({
  groupName,
  onPostUpdate,
  onScheduleSession,
  onAskQuestion,
  className,
}: GroupWelcomeCardProps) {
  // All three actions hover to the same primary tint instead of three
  // unrelated palette colors (teal / emerald / amber). The previous
  // multi-color hover read as "kid's app" against the brand's gold +
  // ink palette and washed out in dark mode.
  const sharedHover = 'hover:border-primary/40 hover:bg-primary/[0.04]';
  const actions: ActionCard[] = [
    {
      icon: <span className="text-2xl">📣</span>,
      label: 'Post an Update',
      description: 'Share news with the group',
      onClick: onPostUpdate,
      colorClass: sharedHover,
    },
    {
      icon: <span className="text-2xl">📅</span>,
      label: 'Schedule a Session',
      description: 'Plan your next game',
      onClick: onScheduleSession,
      colorClass: sharedHover,
    },
    {
      icon: <span className="text-2xl">🏓</span>,
      label: 'Ask a Question',
      description: 'Get help from members',
      onClick: onAskQuestion,
      colorClass: sharedHover,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
    >
      <Card className="overflow-hidden border-border/30 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CardContent className="p-5">
          {/* Welcome Header */}
          <div className="mb-5">
            <h3 className="text-base font-semibold flex items-center gap-2 mb-1">
              Welcome to {groupName}
              <span className="text-lg">👋</span>
            </h3>
            <p className="text-sm text-muted-foreground/80 leading-relaxed">
              Share updates, schedule play, and stay connected with your crew.
            </p>
          </div>

          {/* Action Cards Grid - Responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {actions.map((action, index) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.3 }}
                onClick={action.onClick}
                className={cn(
                  'flex flex-row sm:flex-col items-center p-3 sm:p-4 rounded-xl',
                  'gap-3 sm:gap-0',
                  'justify-start sm:justify-center',
                  'bg-background/60 border border-border/20',
                  'hover:shadow-sm',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20',
                  action.colorClass
                )}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="sm:mb-2 text-xl sm:text-2xl">{action.icon}</div>
                <div className="text-left sm:text-center">
                  <span className="text-xs font-medium leading-tight">
                    {action.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70 block sm:hidden">
                    {action.description}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
