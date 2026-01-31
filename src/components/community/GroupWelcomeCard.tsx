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
  const actions: ActionCard[] = [
    {
      icon: <span className="text-2xl">📣</span>,
      label: 'Post an Update',
      description: 'Share news with the group',
      onClick: onPostUpdate,
      colorClass: 'hover:border-teal-500/30 hover:bg-teal-500/5',
    },
    {
      icon: <span className="text-2xl">📅</span>,
      label: 'Schedule a Session',
      description: 'Plan your next game',
      onClick: onScheduleSession,
      colorClass: 'hover:border-emerald-500/30 hover:bg-emerald-500/5',
    },
    {
      icon: <span className="text-2xl">🏓</span>,
      label: 'Ask a Question',
      description: 'Get help from members',
      onClick: onAskQuestion,
      colorClass: 'hover:border-amber-500/30 hover:bg-amber-500/5',
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

          {/* Action Cards Grid */}
          <div className="grid grid-cols-3 gap-3">
            {actions.map((action, index) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.3 }}
                onClick={action.onClick}
                className={cn(
                  'flex flex-col items-center p-4 rounded-xl',
                  'bg-background/60 border border-border/20',
                  'hover:shadow-sm',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20',
                  action.colorClass
                )}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mb-2">{action.icon}</div>
                <span className="text-xs font-medium text-center leading-tight">
                  {action.label}
                </span>
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
