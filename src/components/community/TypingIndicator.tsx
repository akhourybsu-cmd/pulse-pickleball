import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  typingUsers: { user_id: string; display_name: string }[];
  className?: string;
}

export function TypingIndicator({ typingUsers, className }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const getText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].display_name} is typing`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].display_name} and ${typingUsers[1].display_name} are typing`;
    }
    return `${typingUsers[0].display_name} and ${typingUsers.length - 1} others are typing`;
  };

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5', className)}>
      <div className="flex items-center gap-0.5">
        <span 
          className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" 
          style={{ animationDelay: '0ms', animationDuration: '600ms' }}
        />
        <span 
          className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" 
          style={{ animationDelay: '150ms', animationDuration: '600ms' }}
        />
        <span 
          className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" 
          style={{ animationDelay: '300ms', animationDuration: '600ms' }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{getText()}</span>
    </div>
  );
}
