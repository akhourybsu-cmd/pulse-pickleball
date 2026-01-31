import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  icon?: LucideIcon;
}

interface GroupEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  className?: string;
  /** Display variant - compact is more inline, card is traditional */
  variant?: 'card' | 'compact';
  /** Size variant */
  size?: 'sm' | 'md';
}

export function GroupEmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actions = [],
  className,
  variant = 'card',
  size = 'md',
}: GroupEmptyStateProps) {
  const sizeStyles = {
    sm: {
      container: 'py-8',
      iconWrapper: 'h-12 w-12 mb-3',
      icon: 'h-5 w-5',
      title: 'text-sm mb-1',
      description: 'text-xs mb-4',
    },
    md: {
      container: 'py-12',
      iconWrapper: 'h-14 w-14 mb-4',
      icon: 'h-6 w-6',
      title: 'text-sm mb-1.5',
      description: 'text-sm mb-5',
    },
  };

  const styles = sizeStyles[size];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        styles.container,
        variant === 'compact' && className
      )}
    >
      <div className={cn(
        'rounded-full bg-muted/40 flex items-center justify-center',
        styles.iconWrapper
      )}>
        <Icon className={cn('text-muted-foreground/60', styles.icon)} />
      </div>
      
      <h3 className={cn('font-medium text-foreground', styles.title)}>
        {title}
      </h3>
      
      <p className={cn(
        'text-muted-foreground/80 max-w-xs leading-relaxed font-normal',
        styles.description
      )}>
        {description}
      </p>
      
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? 'default' : 'outline')}
                onClick={action.onClick}
                size="sm"
                className="gap-1.5 h-9 px-4 rounded-xl"
              >
                {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  if (variant === 'compact') {
    return content;
  }

  return (
    <Card className={cn('border-none bg-muted/15', className)}>
      <CardContent className="p-0">
        {content}
      </CardContent>
    </Card>
  );
}
