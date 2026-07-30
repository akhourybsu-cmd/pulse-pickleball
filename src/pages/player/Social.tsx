import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import Friends from "./Friends";
import DirectMessages from "./DirectMessages";
import { GroupChatsList } from "@/components/social/GroupChatsList";

/**
 * Unified Social hub. One destination for Chats (direct + group) and Friends,
 * so a player can move between conversations and their network in one place.
 *
 * The two views render the existing surfaces in `embedded` mode (standalone
 * hero headers suppressed) — one source of truth per surface, no duplicated
 * logic. Active view is derived from the path (/player/friends → Friends;
 * everything else → Chats), so old links keep working and the Friends
 * sub-tab deep-link is untouched.
 */
export default function Social() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const view: "chats" | "friends" =
    location.pathname.startsWith("/player/friends") ? "friends" : "chats";

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Hero (matches the app's player-surface hero pattern). */}
      <div className="border-b border-border/40 bg-gradient-to-b from-primary/[0.06] via-background to-background">
        <div className="container mx-auto px-4 py-4 md:py-5 max-w-3xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground leading-tight">
                Social
              </h1>
              <div className="h-[3px] w-10 mt-1.5 bg-primary rounded-full" />
              <p className="text-sm text-muted-foreground mt-2 leading-snug">
                Your chats and friends in one place
              </p>
            </div>
          </div>

          {/* View switcher — premium animated segmented control. */}
          <div className="mt-4 inline-flex rounded-xl bg-muted/50 p-1" role="tablist" aria-label="Social views">
            <SegButton active={view === "chats"} onClick={() => navigate("/player/social")} icon={MessageCircle} reduced={reduced}>
              Chats
            </SegButton>
            <SegButton active={view === "friends"} onClick={() => navigate("/player/friends")} icon={Users} reduced={reduced}>
              Friends
            </SegButton>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {view === "chats" ? (
          <>
            <GroupChatsList />
            <div className="px-4 pt-4">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Direct messages
              </h2>
            </div>
            <DirectMessages embedded />
          </>
        ) : (
          <Friends embedded />
        )}
      </div>
    </div>
  );
}

function SegButton({
  active, onClick, icon: Icon, reduced, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageCircle;
  reduced: boolean | null;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="social-seg-active"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border/60"
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon className="relative h-4 w-4" />
      <span className="relative">{children}</span>
    </button>
  );
}
