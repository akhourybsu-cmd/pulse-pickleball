import { Link } from "react-router-dom";
import { useGroups } from "@/hooks/useGroups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 8;

export function MyCommunitiesRail() {
  // Home only needs joined-group identity. Public discovery and one unread
  // count query per group belong to the Community screen, not app startup.
  const { myGroups, loading } = useGroups({
    includePublic: false,
    includeUnreadCounts: false,
  });

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-24 rounded-2xl shrink-0" />
        ))}
      </div>
    );
  }

  if (myGroups.length === 0) {
    return (
      <Link
        to="/player/community"
        className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4 transition-[transform,background-color,border-color] hover:border-primary/35 hover:bg-card active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Find a community</p>
          <p className="text-sm text-muted-foreground">
            Join a crew, league, or open-play group near you
          </p>
        </div>
      </Link>
    );
  }

  const visible = myGroups.slice(0, MAX_VISIBLE);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
      {visible.map((g) => {
        const initials = g.name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        const hasUnread = (g.unread_count ?? 0) > 0;
        return (
          <Link
            key={g.id}
            to={`/player/community/group/${g.id}`}
            className="group relative flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-transparent bg-card p-3 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card/80 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
          >
            <div className="relative">
              <Avatar className="h-14 w-14 rounded-2xl">
                <AvatarImage src={g.icon_url || g.cover_url || undefined} alt={g.name} />
                <AvatarFallback className="rounded-2xl bg-primary/15 text-primary font-semibold">
                  {initials || <Users className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              {hasUnread && (
                <span
                  className={cn(
                    "absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary ring-2 ring-background"
                  )}
                  aria-label={`${g.unread_count} new`}
                />
              )}
            </div>
            <p className="line-clamp-2 text-center text-xs font-medium leading-tight text-foreground">
              {g.name}
            </p>
          </Link>
        );
      })}

      <Link
        to="/player/community"
        className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3 text-muted-foreground transition-[transform,color,background-color,border-color] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:text-foreground active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
          <Plus className="h-5 w-5" />
        </div>
        <p className="text-center text-xs font-medium leading-tight">Find more</p>
      </Link>
    </div>
  );
}
