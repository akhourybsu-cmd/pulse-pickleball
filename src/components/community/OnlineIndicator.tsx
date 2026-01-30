import { cn } from '@/lib/utils';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showPulse?: boolean;
}

export function OnlineIndicator({ 
  isOnline, 
  size = 'sm', 
  className,
  showPulse = true 
}: OnlineIndicatorProps) {
  if (!isOnline) return null;

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  return (
    <span 
      className={cn(
        'relative flex',
        sizeClasses[size],
        className
      )}
    >
      <span 
        className={cn(
          'absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75',
          showPulse && 'animate-ping'
        )} 
      />
      <span 
        className={cn(
          'relative inline-flex rounded-full bg-emerald-500',
          sizeClasses[size]
        )} 
      />
    </span>
  );
}
