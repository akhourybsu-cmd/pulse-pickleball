import { useMemo, useState } from "react";
import { isToday, isThisWeek } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MessageCircle, Search, AlertCircle, PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  filterConversations, type InboxFilter, type SocialConversation,
} from "@/lib/social/inbox";
import { useSocialInbox } from "@/hooks/useSocialInbox";
import { ConversationRow } from "./ConversationRow";
import { MessageFriendPickerSheet } from "@/components/messaging/MessageFriendPickerSheet";

/**
 * Unified Social inbox surface — direct messages and group chats in one
 * chronological list. A single compose action (icon) starts a new DM; search
 * and compact All/Unread/Muted filters sit above the list. Presentation only:
 * all data + mutations come from `useSocialInbox` / the underlying hooks.
 */
export function SocialInbox() {
  const {
    conversations, loading, error, markRead, setMuted, leaveConversation, refetch,
  } = useSocialInbox();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [pickerOpen, setPickerOpen] = useState(false);

  const unreadCount = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const mutedCount = conversations.filter((c) => c.isMuted).length;

  const visible = useMemo(
    () => filterConversations(conversations, filter, query),
    [conversations, filter, query],
  );

  // Time sections over the already-sorted (newest-first) list.
  const sections = useMemo(() => {
    const today: SocialConversation[] = [];
    const week: SocialConversation[] = [];
    const earlier: SocialConversation[] = [];
    for (const c of visible) {
      const d = new Date(c.lastActivityAt);
      if (isToday(d)) today.push(c);
      else if (isThisWeek(d, { weekStartsOn: 1 })) week.push(c);
      else earlier.push(c);
    }
    return [
      { label: "Today", items: today },
      { label: "This week", items: week },
      { label: "Earlier", items: earlier },
    ].filter((s) => s.items.length > 0);
  }, [visible]);

  return (
    <div className="flex flex-col">
      {/* Toolbar: search + compose icon */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search chats"
          />
        </div>
        <Button
          size="icon"
          onClick={() => setPickerOpen(true)}
          className="h-9 w-9 shrink-0 rounded-full btn-premium"
          aria-label="New message"
        >
          <PenSquare className="h-4 w-4" />
        </Button>
      </div>

      {/* Compact filters */}
      <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={conversations.length} />
        <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")} label="Unread" count={unreadCount} accent />
        <FilterChip active={filter === "muted"} onClick={() => setFilter("muted")} label="Muted" count={mutedCount} />
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Couldn't load your chats.</span>
          <button onClick={refetch} className="font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      <div className="flex-1 pb-6">
        {loading ? (
          <div className="space-y-2 px-4">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            onCompose={() => setPickerOpen(true)}
            isFiltered={conversations.length > 0}
          />
        ) : (
          <div className="px-4 space-y-5">
            {sections.map((section) => (
              <section key={section.label}>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  {section.label}
                </h2>
                <motion.ul
                  layout={!reduced}
                  className="space-y-1.5"
                >
                  <AnimatePresence initial={false}>
                    {section.items.map((c) => (
                      <ConversationRow
                        key={c.id}
                        conversation={c}
                        onMarkRead={markRead}
                        onToggleMute={setMuted}
                        onLeave={leaveConversation}
                      />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <MessageFriendPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}

function FilterChip({
  active, onClick, label, count, accent,
}: { active: boolean; onClick: () => void; label: string; count: number; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border/40 hover:bg-muted/40",
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold",
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : accent
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ onCompose, isFiltered }: { onCompose: () => void; isFiltered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        {isFiltered ? (
          <Search className="h-6 w-6 text-primary" />
        ) : (
          <MessageCircle className="h-6 w-6 text-primary" />
        )}
      </div>
      <h3 className="text-base font-semibold mb-1 font-display">
        {isFiltered ? "No chats here" : "No conversations yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[280px] mb-5">
        {isFiltered
          ? "Try a different filter or search term."
          : "Message a friend or join a community group to start chatting."}
      </p>
      {!isFiltered && (
        <div className="flex items-center gap-2">
          <Button onClick={onCompose} className="rounded-full btn-premium">
            <PenSquare className="h-4 w-4 mr-1.5" />
            New message
          </Button>
        </div>
      )}
    </div>
  );
}
