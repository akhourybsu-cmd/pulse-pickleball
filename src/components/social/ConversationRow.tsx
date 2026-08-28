import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  Users, BellOff, MoreVertical, Check, ArrowUpRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { SocialConversation } from "@/lib/social/inbox";

const initials = (n: string) =>
  (n || "U").split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);

/**
 * One row in the unified Social inbox — renders a direct message or a group
 * chat from the same normalized `SocialConversation`. Tapping the row opens
 * the conversation; the overflow menu carries per-type actions (DMs can be
 * marked read / muted / left; groups link to their Community page).
 */
export function ConversationRow({
  conversation,
  onMarkRead,
  onToggleMute,
  onLeave,
}: {
  conversation: SocialConversation;
  onMarkRead: (id: string) => void;
  onToggleMute: (id: string, muted: boolean) => void;
  onLeave: (id: string) => void;
}) {
  const navigate = useNavigate();
  const c = conversation;
  const isGroup = c.type === "group";
  const hasUnread = c.unreadCount > 0;

  const open = () => {
    haptic("tap");
    navigate(c.route);
  };

  return (
    <motion.li
      layout
      whileTap={{ scale: 0.99 }}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-2xl border backdrop-blur-sm transition-colors",
        "shadow-[0_2px_16px_-12px_hsl(var(--foreground)/0.4)]",
        hasUnread
          ? "bg-card/85 border-primary/35 shadow-[0_2px_18px_-10px_hsl(var(--primary)/0.45)]"
          : "bg-card/70 border-border/50 hover:bg-card",
      )}
    >
      {hasUnread && (
        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-primary to-primary/30" aria-hidden />
      )}

      <button
        onClick={open}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        aria-label={`Open ${isGroup ? "group" : "conversation"}: ${c.title}`}
      >
        <div className="relative shrink-0">
          <Avatar className="h-12 w-12 ring-1 ring-border/60">
            <AvatarImage src={c.avatarUrl || undefined} />
            <AvatarFallback className={cn(isGroup && "bg-primary/10 text-primary")}>
              {isGroup ? <Users className="h-5 w-5" /> : initials(c.title)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={cn(
                "text-sm truncate",
                hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
              )}>
                {c.title}
              </p>
              {isGroup && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Group
                </span>
              )}
              {c.isMuted && (
                <BellOff className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Muted" />
              )}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(c.lastActivityAt), { addSuffix: false })}
            </span>
          </div>
          {c.lastMessagePreview ? (
            <p className={cn(
              "text-xs truncate mt-0.5",
              hasUnread ? "text-foreground/90 font-medium" : "text-muted-foreground",
            )}>
              {c.lastMessagePreview}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground mt-0.5">
              {isGroup ? "No messages yet" : "Say hi 👋"}
            </p>
          )}
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {hasUnread && (
          <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] justify-center px-1.5">
            {c.unreadCount > 99 ? "99+" : c.unreadCount}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-60 hover:opacity-100"
              aria-label={`Actions for ${c.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {isGroup ? (
              <DropdownMenuItem
                onClick={() => navigate(`/player/community/group/${c.relatedCommunityId ?? c.id}`)}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" /> View group
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem disabled={!hasUnread} onClick={() => onMarkRead(c.id)}>
                  <Check className="h-4 w-4 mr-2" /> Mark as read
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleMute(c.id, !c.isMuted)}>
                  <BellOff className="h-4 w-4 mr-2" />
                  {c.isMuted ? "Unmute" : "Mute"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onLeave(c.id)}
                  className="text-destructive focus:text-destructive"
                >
                  Leave conversation
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.li>
  );
}
