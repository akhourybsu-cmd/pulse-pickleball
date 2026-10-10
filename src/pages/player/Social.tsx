import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Users } from "lucide-react";
import Friends from "./Friends";
import { SocialInbox } from "@/components/social/SocialInbox";
import { PlayerSegmentedControl } from "@/components/layout/PlayerSegmentedControl";
import { useFriends } from "@/hooks/useFriends";
import { useRef } from "react";


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
  const { pendingRequests } = useFriends();
  const view: "chats" | "friends" =
    location.pathname.startsWith("/player/friends") ? "friends" : "chats";
  const destinations = useRef({ chats: '/player/social', friends: '/player/friends' });
  destinations.current[view] = location.pathname + location.search;

  return (
    <div className="flex min-w-0 flex-col min-h-[calc(100dvh-120px)]">
      <header className="container mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">Social</h1>
        <PlayerSegmentedControl
          value={view}
          onValueChange={(next) => navigate(destinations.current[next])}
          options={[
            { value: "chats", label: "Chats", icon: MessageCircle },
            { value: "friends", label: "Friends", icon: Users, count: pendingRequests.length, accentCount: true },
          ]}
          ariaLabel="Social views"
          layoutId="social-seg-active"
          className="max-w-sm sm:w-64"
        />
      </header>

      <div className="container mx-auto min-h-0 max-w-[1400px] flex-1 px-0">
        {view === "chats" ? <SocialInbox /> : <Friends embedded />}
      </div>
    </div>
  );
}
