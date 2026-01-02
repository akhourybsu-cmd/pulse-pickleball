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
    <Card className={cn('border-none bg-muted/20', className)}>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-muted-foreground/70" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">{description}</p>
        
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
      </CardContent>
    </Card>
  );
}
