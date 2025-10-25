import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, MapPin, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LFGPost {
  id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  skill_min: number;
  skill_max: number;
  format: string;
  capacity: number;
  notes: string | null;
  courts: {
    name: string;
    city: string;
    state: string;
  };
  lfg_rsvps: Array<{ status: string }>;
}

interface SmartMatchProps {
  userId: string | null;
}

export function SmartMatch({ userId }: SmartMatchProps) {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<LFGPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchRecommendations();
    }
  }, [userId]);

  const fetchRecommendations = async () => {
    if (!userId) return;

    // Get user's profile to check their rating
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_rating")
      .eq("id", userId)
      .single();

    if (!profile) {
      setLoading(false);
      return;
    }

    const userRating = profile.current_rating;
    const now = new Date().toISOString();

    // Find LFG posts that match user's skill level and are upcoming
    const { data: lfgPosts } = await (supabase as any)
      .from("lfg_posts")
      .select(`
        *,
        courts(name, city, state),
        lfg_rsvps(status)
      `)
      .eq("status", "open")
      .gte("starts_at", now)
      .lte("skill_min", userRating + 0.5)
      .gte("skill_max", userRating - 0.5)
      .order("starts_at", { ascending: true })
      .limit(3);

    if (lfgPosts) {
      setRecommendations(lfgPosts);
    }

    setLoading(false);
  };

  const dismissRecommendation = async (lfgId: string) => {
    if (!userId) return;

    await (supabase as any)
      .from("lfg_matches")
      .insert({
        user_id: userId,
        lfg_id: lfgId,
        match_score: 0,
        dismissed: true,
      });

    setRecommendations(prev => prev.filter(r => r.id !== lfgId));
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    if (date.toDateString() === today.toDateString()) {
      dayLabel = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayLabel = 'Tomorrow';
    }

    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dayLabel} at ${time}`;
  };

  if (loading || !userId) {
    return null;
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Recommended for You
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((lfg) => {
          const confirmedCount = lfg.lfg_rsvps.filter(r => r.status === 'yes').length;
          const spotsLeft = lfg.capacity - confirmedCount;

          return (
            <div key={lfg.id} className="border rounded-lg p-4 space-y-2 relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => dismissRecommendation(lfg.id)}
              >
                <X className="w-4 h-4" />
              </Button>

              <div className="flex items-start justify-between pr-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">
                      {lfg.skill_min.toFixed(1)}-{lfg.skill_max.toFixed(1)}
                    </Badge>
                    <Badge variant="outline">{lfg.format}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {lfg.courts.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatDateTime(lfg.starts_at)}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {confirmedCount}/{lfg.capacity} • {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                </div>
              </div>

              {lfg.notes && (
                <p className="text-sm text-muted-foreground">{lfg.notes}</p>
              )}

              <Button
                size="sm"
                className="w-full"
                onClick={() => navigate(`/court/board/${lfg.court_id}`)}
              >
                View Details
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
