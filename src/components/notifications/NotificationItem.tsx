import { formatDistanceToNow } from "date-fns";
import { 
  Trophy, 
  Calendar, 
  Users, 
  Bell, 
  Target, 
  MessageCircle,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: Notification;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  matches: Target,
  events: Calendar,
  community: Users,
  achievements: Trophy,
  system: Bell,
  bookings: Calendar,
};

const typeIcons: Record<string, React.ElementType> = {
  match_recorded: Target,
  match_verification_needed: AlertTriangle,
  match_verified: CheckCircle,
  match_contested: AlertTriangle,
  group_post_new: MessageCircle,
  group_lfg_new: Users,
  group_lfg_joined: UserPlus,
  post_comment: MessageCircle,
  badge_earned: Trophy,
  event_reminder: Calendar,
  event_registration_confirmed: CheckCircle,
};

const priorityStyles: Record<string, string> = {
  urgent: "border-l-4 border-l-destructive bg-destructive/5",
  high: "border-l-4 border-l-primary bg-primary/5",
  normal: "border-l-4 border-l-transparent",
  low: "border-l-4 border-l-transparent opacity-75",
};

export function NotificationItem({ notification, onSelect, onDismiss }: NotificationItemProps) {
  const Icon = typeIcons[notification.notification_type] || categoryIcons[notification.category] || Bell;
  
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  const handleClick = () => {
    onSelect(notification.id);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss(notification.id);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "hover:bg-accent/50 active:scale-[0.99]",
        priorityStyles[notification.priority] || priorityStyles.normal,
        !notification.read && "bg-accent/30"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
        notification.category === 'achievements' && "bg-amber-500/20 text-amber-500",
        notification.category === 'matches' && "bg-primary/20 text-primary",
        notification.category === 'events' && "bg-blue-500/20 text-blue-500",
        notification.category === 'community' && "bg-green-500/20 text-green-500",
        notification.category === 'system' && "bg-muted text-muted-foreground",
      )}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm font-medium leading-tight",
            !notification.read && "text-foreground",
            notification.read && "text-muted-foreground"
          )}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {timeAgo}
        </p>
      </div>

      {/* Dismiss button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDismiss}
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
