import { Link } from "react-router-dom";
import { useGroups } from "@/hooks/useGroups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 8;

export function MyCommunitiesRail() {
  const { myGroups, loading } = useGroups();

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
        className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4 transition-colors hover:bg-card"
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
            className="group relative flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl bg-card p-3 transition-colors hover:bg-card/80"
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
        className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
          <Plus className="h-5 w-5" />
        </div>
        <p className="text-center text-xs font-medium leading-tight">Find more</p>
      </Link>
    </div>
  );
}
