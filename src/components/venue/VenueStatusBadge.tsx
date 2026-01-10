import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";

interface VenueStatusBadgeProps {
  isPublished: boolean;
  className?: string;
}

export function VenueStatusBadge({ isPublished, className = "" }: VenueStatusBadgeProps) {
  if (isPublished) {
    return (
      <Badge 
        variant="outline" 
        className={`font-medium gap-1.5 bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400 ${className}`}
      >
        <Eye className="h-3 w-3" />
        Published
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`font-medium gap-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 ${className}`}
    >
      <EyeOff className="h-3 w-3" />
      Draft
    </Badge>
  );
}
