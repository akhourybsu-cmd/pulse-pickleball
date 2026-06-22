import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface PresenceUser {
  user_id: string;
  online_at: string;
}

interface CourtPresenceProps {
  courtId: string;
  channelId: string;
}

export function CourtPresence({ courtId, channelId }: CourtPresenceProps) {
  const [onlineUsers, setOnlineUsers] = useState<Profile[]>([]);
  const [checkedInUsers, setCheckedInUsers] = useState<Profile[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`court-presence-${channelId}`);

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const userIds = Object.keys(state).map(key => state[key][0].user_id);
        fetchProfiles(userIds, setOnlineUsers);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    fetchCheckedInUsers();
    const interval = setInterval(fetchCheckedInUsers, 30000); // Refresh every 30s

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [courtId, channelId]);

  const fetchProfiles = async (userIds: string[], setter: (profiles: Profile[]) => void) => {
    if (userIds.length === 0) {
      setter([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (data) {
      setter(data);
    }
  };

  const fetchCheckedInUsers = async () => {
    const { data } = await (supabase as any)
      .from("court_checkins")
      .select("user_id, profiles:profiles_public!court_checkins_user_id_fkey(id, full_name, avatar_url)")
      .eq("court_id", courtId)
      .gt("ends_at", new Date().toISOString());

    if (data) {
      const profiles = data
        .map((c: any) => c.profiles)
        .filter(Boolean);
      setCheckedInUsers(profiles);
    }
  };

  return (
    <div className="space-y-4">
      {checkedInUsers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">At the Courts ({checkedInUsers.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {checkedInUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2 bg-primary/10 rounded-full px-2 py-1">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {user.full_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{user.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onlineUsers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Online ({onlineUsers.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {onlineUsers.map((user) => (
              <Avatar key={user.id} className="w-8 h-8" title={user.full_name}>
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {user.full_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
