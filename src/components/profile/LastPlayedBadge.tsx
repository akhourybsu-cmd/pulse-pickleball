import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface LastPlayedBadgeProps {
  days: number | null;
  className?: string;
}

export const LastPlayedBadge = ({ days, className }: LastPlayedBadgeProps) => {
  if (days === null) return null;

  const getStatusStyles = () => {
    if (days <= 7) {
      return "bg-primary/10 text-primary border-primary/20";
    } else if (days <= 14) {
      return "bg-muted text-muted-foreground border-muted-foreground/20";
    } else {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
  };

  const getStatusText = () => {
    if (days === 0) return "Played today";
    if (days === 1) return "Played yesterday";
    return `${days} days ago`;
  };

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        getStatusStyles(),
        className
      )}
    >
      <Clock className="w-3 h-3" />
      {getStatusText()}
    </span>
  );
};
