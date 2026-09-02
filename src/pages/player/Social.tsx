import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Users } from "lucide-react";
import Friends from "./Friends";
import { SocialInbox } from "@/components/social/SocialInbox";
import { SocialHero } from "@/components/social/_shared";
import { PlayerSegmentedControl } from "@/components/layout/PlayerSegmentedControl";


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
  const view: "chats" | "friends" =
    location.pathname.startsWith("/player/friends") ? "friends" : "chats";

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Shared player title band with the Chats/Friends switch beneath it. */}
      <SocialHero
        eyebrow="Connect"
        title="Social"
      >
        <PlayerSegmentedControl
          value={view}
          onValueChange={(next) => navigate(next === "chats" ? "/player/social" : "/player/friends")}
          options={[
            { value: "chats", label: "Chats", icon: MessageCircle },
            { value: "friends", label: "Friends", icon: Users },
          ]}
          ariaLabel="Social views"
          layoutId="social-seg-active"
          className="mt-3 max-w-sm"
        />
      </SocialHero>

      <div className="container mx-auto min-h-0 max-w-[1400px] flex-1 px-0">
        {view === "chats" ? <SocialInbox /> : <Friends embedded />}
      </div>
    </div>
  );
}
