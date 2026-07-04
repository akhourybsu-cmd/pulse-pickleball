import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
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
  X,
  ChevronRight,
  Clock,
  Star,
  MapPin,
  UserCheck,
  CreditCard,
  AlertCircle,
  XCircle,
  FileText,
  Swords,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: Notification;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
}

// Icon mapping for different notification types
const typeIcons: Record<string, React.ElementType> = {
  // Match notifications
  match_recorded: Target,
  match_verification_needed: AlertTriangle,
  match_verified: CheckCircle,
  match_contested: AlertTriangle,
  match_scheduled: Calendar,
  match_starting_soon: AlertTriangle,
  match_court_assigned: MapPin,
  match_started: Swords,
  match_completed: CheckCircle,
  match_won: Trophy,
  match_lost: Flag,
  match_disputed: AlertTriangle,
  match_dispute_resolved: CheckCircle,
  match_forfeited: XCircle,
  next_match_ready: Swords,
  
  // Registration notifications — shared between round robins, open play,
  // and (when re-enabled) tournaments. Kept active because round robins
  // still surface these.
  registration_submitted: FileText,
  registration_approved: CheckCircle,
  registration_waitlisted: Clock,
  registration_rejected: XCircle,
  waitlist_promoted: Star,
  team_assigned: Users,
  partner_joined_team: UserPlus,
  partner_left_team: AlertCircle,
  registration_cancelled: XCircle,
  registration_closing_soon: Clock,
  schedule_released: FileText,

  // Check-in notifications (round-robin check-ins are still active)
  checkin_open: UserCheck,
  checkin_reminder: Bell,
  checked_in_confirmed: CheckCircle,
  checkin_missed: AlertCircle,
  weather_delay: AlertTriangle,

  // Announcements
  schedule_change: Calendar,
  venue_change: MapPin,

  // League Play — separate from open-play matches. Deep-link to
  // /player/leagues/:id which drops the player straight into their
  // league detail view.
  league_score_submitted: Target,
  league_match_verified: Trophy,
  league_match_disputed: AlertTriangle,
  league_dispute_resolved: CheckCircle,
  league_match_forfeited: Flag,

  // Tournament-specific notification icons removed during the player-only
  // beta. Tournament types still in the DB schema fall through to the
  // generic Bell icon via the typeIcons[...] || Bell fallback below.

  // Payment notifications
  payment_confirmed: CreditCard,
  payment_failed: AlertCircle,
  refund_processed: CreditCard,
  payment_reminder: CreditCard,
  
  // Community notifications
  group_post_new: MessageCircle,
  group_lfg_new: Users,
  group_lfg_joined: UserPlus,
  post_comment: MessageCircle,
  
  // Achievement notifications
  badge_earned: Trophy,
  
  // Event notifications
  event_reminder: Calendar,
  event_registration_confirmed: CheckCircle,
};

// Category colors for icon backgrounds. The `tournaments` category was
// dropped during the player-only beta — any tournament notification still
// in the DB falls back to the system color.
const categoryColors: Record<string, string> = {
  matches: "bg-blue-500/20 text-blue-500",
  events: "bg-indigo-500/20 text-indigo-500",
  community: "bg-green-500/20 text-green-500",
  achievements: "bg-amber-500/20 text-amber-500",
  system: "bg-muted text-muted-foreground",
  bookings: "bg-purple-500/20 text-purple-500",
};

// Priority border colors
const priorityBorders: Record<string, string> = {
  urgent: "border-l-4 border-l-destructive",
  high: "border-l-4 border-l-primary",
  normal: "border-l-4 border-l-transparent",
  low: "border-l-4 border-l-transparent",
};

const SWIPE_THRESHOLD = 100;

export function NotificationItem({ notification, onSelect, onDismiss }: NotificationItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [0.5, 1]);
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -50, 0], [1, 0.5, 0]);
  
  const Icon = typeIcons[notification.notification_type] || Bell;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });
  
  const categoryColor = categoryColors[notification.category] || categoryColors.system;
  const priorityBorder = priorityBorders[notification.priority] || priorityBorders.normal;

  const handleClick = () => {
    onSelect(notification.id);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    setTimeout(() => onDismiss(notification.id), 200);
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      setIsDeleting(true);
      setTimeout(() => onDismiss(notification.id), 200);
    }
  };

  // Check if notification has an actionable link
  const hasAction = !!notification.link;

  return (
    <div className="relative overflow-hidden">
      {/* Delete indicator (revealed on swipe) */}
      <motion.div 
        className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-destructive"
        style={{ opacity: deleteOpacity }}
      >
        <X className="h-5 w-5 text-destructive-foreground" />
      </motion.div>
      
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x, opacity }}
        animate={isDeleting ? { x: -300, opacity: 0 } : {}}
        transition={{ duration: 0.2 }}
        onClick={handleClick}
        className={cn(
          "relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
          "hover:bg-accent/50 active:scale-[0.99] bg-background",
          priorityBorder,
          !notification.read && "bg-accent/30"
        )}
      >
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          categoryColor
        )}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-8">
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

        {/* Right side: Chevron for actionable + Delete button */}
        <div className="absolute right-2 top-3 flex items-center gap-1">
          {/* Delete button - always visible on mobile, hover on desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-50 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Dismiss</span>
          </Button>
          
          {/* Chevron indicator for actionable notifications */}
          {hasAction && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </motion.div>
    </div>
  );
}
