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

interface GroupEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  className?: string;
}

export function GroupEmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actions = [],
  className 
}: GroupEmptyStateProps) {
  return (
    <Card className={cn('border-none bg-muted/30', className)}>
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
        
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
                  className="gap-1.5"
                >
                  {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
