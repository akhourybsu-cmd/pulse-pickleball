import { Link } from "react-router-dom";
import { useFriends } from "@/hooks/useFriends";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Users, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 10;

/**
 * Horizontal "My friends" rail for the player Dashboard. Mirrors the visual
 * contract of MyCommunitiesRail so the two social surfaces feel like a pair.
 * Pending received requests surface as a leading "Requests" tile with a
 * pulse dot so they're glanceable without their own section.
 */
export function MyFriendsRail() {
  const { friends, pendingRequests, loading } = useFriends({ includeSent: false });

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-24 rounded-2xl shrink-0" />
        ))}
      </div>
    );
  }

  const hasPending = pendingRequests.length > 0;

  if (friends.length === 0 && !hasPending) {
    return (
      <Link
        to="/player/friends"
        className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-card/60 p-4 transition-[transform,background-color,border-color] hover:border-primary/45 hover:bg-card active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Find players</p>
          <p className="text-sm text-muted-foreground">
            Add friends to message, partner up, and track rivalries
          </p>
        </div>
      </Link>
    );
  }

  const visible = friends.slice(0, MAX_VISIBLE);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-none">
      {hasPending && (
        <Link
          to="/player/friends?tab=requests"
          className="group relative flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 p-3 shadow-[0_2px_16px_-10px_hsl(var(--primary)/0.5)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-primary/15 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
        >
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <span
              className={cn(
                "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background"
              )}
              aria-label={`${pendingRequests.length} pending request${pendingRequests.length === 1 ? "" : "s"}`}
            >
              {pendingRequests.length}
            </span>
          </div>
          <p className="line-clamp-2 text-center text-xs font-semibold leading-tight tracking-tight text-foreground">
            {pendingRequests.length === 1 ? "1 request" : `${pendingRequests.length} requests`}
          </p>
        </Link>
      )}

      {visible.map((f) => {
        const name = f.profile.display_name || f.profile.full_name || "Player";
        const initials = name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return (
          <Link
            key={f.id}
            to="/player/friends"
            className="group relative flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-[0_2px_16px_-12px_hsl(var(--foreground)/0.4)] transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
          >
            <Avatar className="h-14 w-14 rounded-2xl ring-1 ring-border/60">
              <AvatarImage src={f.profile.avatar_url || undefined} alt={name} />
              <AvatarFallback className="rounded-2xl bg-primary/15 text-primary font-semibold">
                {initials || <Users className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <p className="line-clamp-2 text-center text-xs font-semibold leading-tight tracking-tight text-foreground">
              {name}
            </p>
          </Link>
        );
      })}

      <Link
        to="/player/friends"
        className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-3 text-muted-foreground transition-[transform,color,background-color,border-color] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:text-foreground active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
          <UserPlus className="h-5 w-5" />
        </div>
        <p className="text-center text-xs font-medium leading-tight">Add more</p>
      </Link>
    </div>
  );
}
