import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, MapPin, Users, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface LFGNotification {
  id: string;
  lfg_id: string;
  starts_at: string;
  capacity: number;
  format: string;
  intensity: string;
  title: string;
  court_name: string;
  court_id: string;
  rsvp_count: number;
  user_rsvp?: string;
}

export function LFGNotifications() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<LFGNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel('lfg-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lfg_posts' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lfg_rsvps' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const now = new Date().toISOString();
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Get upcoming LFG posts in the next 24 hours
    const { data: lfgPosts } = await (supabase as any)
      .from("lfg_posts")
      .select(`
        id,
        starts_at,
        capacity,
        format,
        intensity,
        title,
        court_id,
        courts!inner(id, name),
        lfg_rsvps(status, user_id)
      `)
      .eq("status", "open")
      .gte("starts_at", now)
      .lte("starts_at", twentyFourHoursFromNow)
      .order("starts_at", { ascending: true });

    if (lfgPosts) {
      const formattedNotifications = lfgPosts.map((post: any) => ({
        id: post.id,
        lfg_id: post.id,
        starts_at: post.starts_at,
        capacity: post.capacity,
        format: post.format,
        intensity: post.intensity || 'casual',
        title: post.title || '',
        court_name: post.courts.name,
        court_id: post.courts.id,
        rsvp_count: post.lfg_rsvps.filter((r: any) => r.status === 'yes').length,
        user_rsvp: post.lfg_rsvps.find((r: any) => r.user_id === user.id)?.status,
      }));

      setNotifications(formattedNotifications);
    }
  };

  const handleRSVP = async (lfgId: string, status: 'yes' | 'no') => {
    if (!userId) return;

    const { error: deleteError } = await (supabase as any)
      .from("lfg_rsvps")
      .delete()
      .eq("lfg_id", lfgId)
      .eq("user_id", userId);

    if (status === 'yes') {
      const { error: insertError } = await (supabase as any)
        .from("lfg_rsvps")
        .insert({
          lfg_id: lfgId,
          user_id: userId,
          status: 'yes',
        });

      if (insertError) {
        toast({
          title: "Error",
          description: "Failed to RSVP",
          variant: "destructive",
        });
      } else {
        toast({
          title: "RSVP Confirmed",
          description: "You're in! See you on the court.",
        });
      }
    } else {
      toast({
        title: "RSVP Declined",
        description: "Maybe next time!",
      });
    }

    fetchNotifications();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const hours = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor((date.getTime() - now.getTime()) / (1000 * 60));
      return `in ${minutes}m`;
    } else if (hours < 24) {
      return `in ${hours}h`;
    }
    
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Upcoming Games
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.map((notif) => {
          const spotsLeft = notif.capacity - notif.rsvp_count;
          const hasRSVPd = notif.user_rsvp === 'yes';

          return (
            <div key={notif.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={hasRSVPd ? "default" : "secondary"} className="capitalize">
                      {notif.intensity}
                    </Badge>
                    <Badge variant="outline">{notif.format}</Badge>
                    {hasRSVPd && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {notif.court_name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatTime(notif.starts_at)}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {notif.rsvp_count}/{notif.capacity} • {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                </div>
              </div>

              {!hasRSVPd ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleRSVP(notif.lfg_id, 'yes')}
                  >
                    I'm In
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/court/board/${notif.court_id}`)}
                  >
                    Details
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleRSVP(notif.lfg_id, 'no')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel RSVP
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/court/board/${notif.court_id}`)}
                  >
                    View Details
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
