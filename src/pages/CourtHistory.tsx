import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft, MapPin, Users, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface RecentActivity {
  id: string;
  user_id: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function CourtHistory() {
  const navigate = useNavigate();
  const [courts, setCourts] = useState<Court[]>([]);
  const [recentActivity, setRecentActivity] = useState<Map<string, RecentActivity[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: courtsData } = await supabase
      .from("courts")
      .select("*")
      .order("name");

    if (courtsData) {
      setCourts(courtsData);

      const activityMap = new Map<string, RecentActivity[]>();
      
      for (const court of courtsData) {
        const { data: checkIns } = await (supabase as any)
          .from("court_checkins")
          .select("id, user_id, created_at, profiles:profiles_public!court_checkins_user_id_fkey(full_name, avatar_url)")
          .eq("court_id", court.id)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(5);

        if (checkIns) {
          activityMap.set(court.id, checkIns);
        }
      }

      setRecentActivity(activityMap);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/player/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Court History</h1>
          <p className="text-muted-foreground">Past games and top performers at each court</p>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="grid gap-6">
            {courts.map((court) => {
              const activity = recentActivity.get(court.id) || [];
              const activityCount = activity.length;

              return (
                <Card key={court.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/court/board/${court.id}`)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle>{court.name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          {court.city}, {court.state}
                        </div>
                      </div>
                      <Badge variant={activityCount > 3 ? "default" : "secondary"} className="gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {activityCount} recent
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activity.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          Recent visitors (last 7 days)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activity.map((act) => (
                            <div key={act.id} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={act.profiles?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {act.profiles?.full_name?.substring(0, 2).toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs">{act.profiles?.full_name || "Unknown"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
