import { useNavigate } from "react-router-dom";
import { memo } from "react";
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
import { inboxCount } from "@/lib/social/inbox";
import { conversationTime } from "@/lib/social/conversationTime";

const initials = (n: string) =>
  (n || "U").split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);

/**
 * One row in the unified Social inbox — renders a direct message or a group
 * chat from the same normalized `SocialConversation`. Tapping the row opens
 * the conversation; the overflow menu carries per-type actions (DMs can be
 * marked read / muted / left; groups link to their Community page).
 */
export const ConversationRow = memo(function ConversationRow({
  conversation,
  onMarkRead,
  onToggleMute,
  onLeave,
}: {
  conversation: SocialConversation;
  onMarkRead?: (id: string) => void;
  onToggleMute: (id: string, muted: boolean) => void;
  onLeave: (id: string) => void;
}) {
  const navigate = useNavigate();
  const c = conversation;
  const isGroup = c.type === "group";
  const hasUnread = c.unreadCount > 0;
  const time = conversationTime(c.lastActivityAt);

  const open = () => {
    haptic("tap");
    // Clear the shared inbox row immediately so the Social badge responds on
    // the same tap that opens a DM. The thread performs its own persistence
    // update too; this provider-level update keeps every inbox surface synced.
    if (!isGroup && hasUnread) onMarkRead?.(c.id);
    navigate(c.route, { state: isGroup ? { fromSocialInbox: true } : undefined });
  };

  return (
    <li
      className={cn(
        "group relative flex min-h-[88px] items-center gap-1 rounded-2xl border p-3 transition-colors sm:gap-2 sm:p-4",
        hasUnread
          ? "bg-primary/[0.045] border-primary/25"
          : "bg-card border-border/50 hover:border-primary/20 hover:bg-muted/25",
      )}
    >
      {hasUnread && (
        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-primary to-primary/30" aria-hidden />
      )}

      <button
        onClick={open}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        type="button"
        aria-label={`Open ${isGroup ? "group" : "conversation"}: ${c.title}${hasUnread ? `, ${inboxCount(c.unreadCount)} unread messages` : ''}`}
      >
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11 ring-1 ring-border/60 sm:h-12 sm:w-12">
            <AvatarImage src={c.avatarUrl || undefined} alt="" />
            <AvatarFallback className={cn(isGroup && "bg-primary/10 text-primary")}>
              {isGroup ? <Users className="h-5 w-5" /> : initials(c.title)}
            </AvatarFallback>
          </Avatar>
          {isGroup && <span aria-hidden className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-muted text-foreground"><Users className="h-3 w-3" /></span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={cn(
                "text-sm truncate leading-5",
                hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
              )}>
                {c.title}
              </p>
              {c.isMuted && (
                <BellOff className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Muted" />
              )}
            </div>
          </div>
          {c.lastMessagePreview ? (
            <p className={cn(
              "text-[13px] leading-5 line-clamp-2 mt-1 [overflow-wrap:anywhere]",
              hasUnread ? "text-foreground/90 font-medium" : "text-muted-foreground",
            )}>
              {c.lastMessagePreview}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground mt-0.5">
              {isGroup ? "Start the conversation" : "Send your first message"}
            </p>
          )}
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <time dateTime={time.iso} title={time.full} className="text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">{time.short}</time>
        <div className="flex items-center gap-1">
        {hasUnread && <Badge aria-hidden className="h-5 min-w-5 justify-center bg-primary px-1.5 text-[10px] text-primary-foreground">{inboxCount(c.unreadCount)}</Badge>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground"
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
                <DropdownMenuItem disabled={!hasUnread} onClick={() => onMarkRead?.(c.id)}>
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
      </div>
    </li>
  );
});
