import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  className?: string;
  /** Use card styling (default) or inline styling */
  variant?: 'card' | 'inline';
  /** Size of the empty state */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Generic EmptyState component for displaying empty states with actionable CTAs.
 * Use this across the app for consistent empty state handling.
 * 
 * Empty states are instructional, not blank - they guide users on what to do next.
 */
export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actions = [],
  className,
  variant = 'card',
  size = 'md'
}: EmptyStateProps) {
  const sizeStyles = {
    sm: {
      container: 'py-8',
      iconWrapper: 'h-12 w-12',
      icon: 'h-5 w-5',
      title: 'text-sm',
      description: 'text-xs',
    },
    md: {
      container: 'py-12',
      iconWrapper: 'h-16 w-16',
      icon: 'h-7 w-7',
      title: 'text-base',
      description: 'text-sm',
    },
    lg: {
      container: 'py-16',
      iconWrapper: 'h-20 w-20',
      icon: 'h-9 w-9',
      title: 'text-lg',
      description: 'text-base',
    },
  };

  const styles = sizeStyles[size];

  const content = (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      styles.container,
      variant === 'inline' && className
    )}>
      <div className={cn(
        'rounded-full bg-muted/50 flex items-center justify-center mb-4',
        styles.iconWrapper
      )}>
        <Icon className={cn('text-muted-foreground/70', styles.icon)} />
      </div>
      
      <h3 className={cn('font-medium text-foreground mb-2', styles.title)}>
        {title}
      </h3>
      
      <p className={cn(
        'text-muted-foreground max-w-md mb-6 leading-relaxed font-normal',
        styles.description
      )}>
        {description}
      </p>
      
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? 'default' : 'outline')}
                onClick={action.onClick}
                size="sm"
                className="gap-1.5"
              >
                {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return content;
  }

  return (
    <Card className={cn('border-none bg-muted/20', className)}>
      <CardContent className="p-0">
        {content}
      </CardContent>
    </Card>
  );
}
