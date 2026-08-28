import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import Friends from "./Friends";
import { SocialInbox } from "@/components/social/SocialInbox";
import { SocialHero } from "@/components/social/_shared";


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
      {/* Premium hero band — ambient bloom + court lines, with the
          Chats/Friends switch leading (no redundant "Social" title). */}
      <SocialHero
        eyebrow="Community"
        title={view === "friends" ? "Friends" : "Chats"}
      >
        <div
          className="mt-3 inline-flex rounded-xl border border-border/60 bg-card/70 p-1 backdrop-blur-sm shadow-[0_2px_14px_-10px_hsl(var(--foreground)/0.35)]"
          role="tablist"
          aria-label="Social views"
        >
          <SegButton active={view === "chats"} onClick={() => navigate("/player/social")} icon={MessageCircle} reduced={reduced}>
            Chats
          </SegButton>
          <SegButton active={view === "friends"} onClick={() => navigate("/player/friends")} icon={Users} reduced={reduced}>
            Friends
          </SegButton>
        </div>
      </SocialHero>

      <div className="flex-1 min-h-0 container mx-auto max-w-3xl px-0">
        {view === "chats" ? <SocialInbox /> : <Friends embedded />}
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
