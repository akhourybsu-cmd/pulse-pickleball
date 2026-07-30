import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import Friends from "./Friends";
import DirectMessages from "./DirectMessages";
import { GroupChatsList } from "@/components/social/GroupChatsList";

/**
 * Unified Social hub. One destination for Chats (direct messages) + Friends,
 * so a player can jump between conversations and their network in one place.
 *
 * The two views are the existing surfaces rendered in `embedded` mode (their
 * standalone hero headers suppressed) so there's a single source of truth for
 * each — no duplicated inbox/friends logic. The active view is derived from
 * the path: /player/friends → Friends; everything else → Chats. This keeps
 * old links (/player/friends?tab=requests, /player/messages) working and lets
 * the Friends sub-tab deep-link untouched.
 */
export default function Social() {
  const location = useLocation();
  const navigate = useNavigate();
  const view: "chats" | "friends" =
    location.pathname.startsWith("/player/friends") ? "friends" : "chats";

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Hub header */}
      <div className="border-b border-border/40 bg-gradient-to-b from-primary/[0.06] via-background to-background">
        <div className="container mx-auto px-4 py-4 md:py-5 max-w-3xl">
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground leading-tight">
            Social
          </h1>
          <div className="h-[3px] w-10 mt-1.5 bg-primary rounded-full" />
          <p className="text-sm text-muted-foreground mt-2 leading-snug">
            Your chats and friends in one place
          </p>

          {/* View switcher */}
          <div className="mt-4 inline-flex rounded-xl bg-muted/40 p-1" role="tablist" aria-label="Social views">
            <SegButton active={view === "chats"} onClick={() => navigate("/player/social")} icon={MessageCircle}>
              Chats
            </SegButton>
            <SegButton active={view === "friends"} onClick={() => navigate("/player/friends")} icon={Users}>
              Friends
            </SegButton>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {view === "chats" ? (
          <>
            <GroupChatsList />
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
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageCircle;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
