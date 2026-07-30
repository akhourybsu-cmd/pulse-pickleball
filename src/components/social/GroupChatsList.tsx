import { useNavigate } from "react-router-dom";
import { Users2, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGroups } from "@/hooks/useGroups";

/**
 * Group-chats section for the Social hub's Chats view. Lists the player's
 * communities and taps straight into each group's Chat tab, so group
 * conversations live alongside direct messages in one place.
 *
 * Reuses the existing useGroups data (name / icon / member count / unread
 * signal); it does not re-implement unread math. Renders nothing when the
 * player has no groups, so it never adds empty chrome.
 */
const initials = (n: string) =>
  (n || "G").split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);

export function GroupChatsList() {
  const navigate = useNavigate();
  const { myGroups, loading } = useGroups();

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-2">
        <SectionLabel />
        {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (myGroups.length === 0) return null;

  return (
    <div className="px-4 pt-4">
      <SectionLabel />
      <ul className="space-y-1.5">
        {myGroups.map((g) => {
          const unread = g.unread_count ?? 0;
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => navigate(`/player/community/group/${g.id}?tab=chat`)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                  unread > 0
                    ? "border-primary/30 bg-card shadow-sm"
                    : "border-border/30 bg-card hover:bg-muted/30",
                )}
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-primary/10 flex items-center justify-center">
                  {g.icon_url ? (
                    <img src={g.icon_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{initials(g.name)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("truncate text-sm", unread > 0 ? "font-semibold" : "font-medium text-foreground/90")}>
                      {g.name}
                    </p>
                    <Users2 className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {g.member_count} member{g.member_count === 1 ? "" : "s"} · Group chat
                  </p>
                </div>
                {unread > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-0.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SectionLabel() {
  return (
    <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      Group chats
    </h2>
  );
}
