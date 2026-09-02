import { useMemo, useState } from "react";
import { isToday, isThisWeek } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MessageCircle, Search, AlertCircle, PenSquare, Inbox, VolumeX, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SocialEmptyState } from "./_shared";
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
    <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8 lg:px-8 lg:py-6 xl:grid-cols-[minmax(0,820px)_minmax(280px,1fr)]">
      <div className="min-w-0 lg:overflow-hidden lg:rounded-[24px] lg:border lg:border-border/60 lg:bg-card/55 lg:pb-6 lg:shadow-[0_18px_45px_-38px_hsl(var(--foreground)/0.5)]">
      {/* Toolbar: search + compose icon */}
      <div className="flex items-center gap-2 px-4 pb-2 pt-3 sm:px-6 lg:pt-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-xl border-border/60 bg-card/80 pl-9"
            aria-label="Search chats"
          />
        </div>
        <Button
          size="icon"
          onClick={() => setPickerOpen(true)}
          className="h-11 w-11 shrink-0 rounded-xl btn-premium active:scale-95"
          aria-label="New message"
        >
          <PenSquare className="h-4 w-4" />
        </Button>
      </div>

      {/* Compact filters */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
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
          <div className="space-y-2 px-4 sm:px-6">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            onCompose={() => setPickerOpen(true)}
            isFiltered={conversations.length > 0}
          />
        ) : (
          <div className="space-y-5 px-4 sm:px-6">
            {sections.map((section) => (
              <section key={section.label}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <span aria-hidden className="h-[2px] w-4 rounded-full bg-primary/70" />
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
      </div>

      <aside className="hidden space-y-5 lg:block">
        <div className="sticky top-[96px] space-y-5">
          <div className="rounded-[24px] border border-border/60 bg-card/75 p-5 shadow-[0_18px_45px_-38px_hsl(var(--foreground)/0.5)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">At a glance</p>
                <h2 className="mt-1 text-lg font-bold tracking-tight">Your inbox</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Inbox className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: 'Chats', value: conversations.length, icon: MessageCircle },
                { label: 'Unread', value: unreadCount, icon: Zap },
                { label: 'Muted', value: mutedCount, icon: VolumeX },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-border/50 bg-background/65 p-3">
                  <Icon className="h-4 w-4 text-primary/80" />
                  <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => setPickerOpen(true)} className="mt-4 h-11 w-full rounded-xl btn-premium">
              <PenSquare className="mr-2 h-4 w-4" />Start a conversation
            </Button>
          </div>

          <div className="rounded-[24px] border border-border/60 bg-muted/30 p-5">
            <p className="text-sm font-semibold">Keep plans moving</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Direct messages and community chats stay together here, ordered by the latest activity.
            </p>
          </div>
        </div>
      </aside>

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
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.08em] transition-[transform,color,background-color,border-color] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.6)]"
          : "bg-card/70 text-muted-foreground border-border/50 hover:text-foreground hover:bg-card",
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
    <SocialEmptyState
      icon={isFiltered ? Search : MessageCircle}
      title={isFiltered ? "No chats here" : "No conversations yet"}
      description={
        isFiltered
          ? "Try a different filter or search term."
          : "Message a friend or join a community group to start chatting."
      }
      action={
        isFiltered ? undefined : (
          <Button onClick={onCompose} className="rounded-full btn-premium">
            <PenSquare className="h-4 w-4 mr-1.5" />
            New message
          </Button>
        )
      }
    />
  );
}
